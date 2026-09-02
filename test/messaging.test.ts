import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  normalizeBaileys,
  normalizeMetaInstagram,
  normalizeMetaWhatsApp,
  normalizePhone,
} from '../src/lib/messaging/normalize.ts';
import { verifyHmac, verifyHmacSha1 } from '../src/lib/messaging/signature.ts';

test('normaliza teléfonos chilenos sin alterar E.164', () => {
  assert.equal(normalizePhone('+56 9 9081 6124'), '56990816124');
  assert.equal(normalizePhone('990816124'), '56990816124');
});

test('normaliza mensaje entrante Cloud API con wamid como idempotency key', () => {
  const [message] = normalizeMetaWhatsApp({
    entry: [{
      changes: [{
        value: {
          contacts: [{ profile: { name: 'Cliente' } }],
          messages: [{
            id: 'wamid.abc',
            from: '56911111111',
            timestamp: '1700000000',
            type: 'text',
            text: { body: 'Hola' },
          }],
        },
      }],
    }],
  });
  assert.equal(message.provider_message_id, 'wamid.abc');
  assert.equal(message.transport, 'cloud_api');
  assert.equal(message.text, 'Hola');
  assert.equal(message.direction, 'inbound');
});

test('normaliza estados sin inventar mensajes de cliente', () => {
  const [message] = normalizeMetaWhatsApp({
    entry: [{
      changes: [{
        value: {
          statuses: [{
            id: 'wamid.out',
            recipient_id: '56911111111',
            timestamp: '1700000000',
            status: 'delivered',
          }],
        },
      }],
    }],
  });
  assert.equal(message.message_type, 'status:delivered');
  assert.equal(message.text, null);
  assert.equal(message.sender_type, 'system');
});

test('normaliza Baileys con su key real y marca fromMe como humano', () => {
  const message = normalizeBaileys({
    messageId: 'BAE5KEY',
    remoteJid: '56911111111@s.whatsapp.net',
    phone: '56911111111',
    text: 'Respuesta',
    fromMe: true,
    timestamp: '2026-08-12T00:00:00Z',
  });
  assert.equal(message.provider_message_id, 'BAE5KEY');
  assert.equal(message.transport, 'baileys');
  assert.equal(message.sender_type, 'human');
});

test('valida HMAC y rechaza alteración', () => {
  const raw = '{"ok":true}';
  const secret = 'secret';
  const signature = `sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`;
  assert.equal(verifyHmac(raw, signature, secret), true);
  assert.equal(verifyHmac(`${raw}x`, signature, secret), false);
  assert.equal(verifyHmac(raw, 'sha256=bad', secret), false);
});

test('diagnóstico legacy valida HMAC SHA-1 sin aceptar una firma alterada', () => {
  const raw = '{"object":"instagram"}';
  const secret = 'secret';
  const signature = `sha1=${createHmac('sha1', secret).update(raw).digest('hex')}`;
  assert.equal(verifyHmacSha1(raw, signature, secret), true);
  assert.equal(verifyHmacSha1(`${raw}x`, signature, secret), false);
  assert.equal(verifyHmacSha1(raw, 'sha1=bad', secret), false);
});

test('misma entrega genera una clave estable por transporte', () => {
  const payload = {
    entry: [{
      changes: [{
        value: {
          messages: [{
            id: 'wamid.same',
            from: '56911111111',
            timestamp: '1700000000',
            type: 'text',
            text: { body: 'duplicado' },
          }],
        },
      }],
    }],
  };
  const first = normalizeMetaWhatsApp(payload)[0];
  const second = normalizeMetaWhatsApp(payload)[0];
  assert.deepEqual(
    [first.provider, first.transport, first.provider_message_id],
    [second.provider, second.transport, second.provider_message_id],
  );
});

test('Instagram normaliza texto inbound con el mid como clave idempotente', () => {
  const [message] = normalizeMetaInstagram({
    object: 'instagram',
    entry: [{
      id: '17841419477422736',
      time: 1700000000000,
      messaging: [{
        sender: { id: 'ig-customer-1' },
        recipient: { id: '17841419477422736' },
        timestamp: 1700000000000,
        message: { mid: 'ig-mid-1', text: 'Hola Remy' },
      }],
    }],
  });

  assert.equal(message.channel, 'instagram');
  assert.equal(message.provider_message_id, 'ig-mid-1');
  assert.equal(message.external_thread_id, 'ig-customer-1');
  assert.equal(message.direction, 'inbound');
  assert.equal(message.text, 'Hola Remy');
  assert.deepEqual(message.attachments, []);
});

test('Instagram conserva metadatos seguros de imagen, video y audio', () => {
  const [message] = normalizeMetaInstagram({
    object: 'instagram',
    entry: [{
      id: '17841419477422736',
      messaging: [{
        sender: { id: 'ig-customer-2' },
        recipient: { id: '17841419477422736' },
        timestamp: 1700000000000,
        message: {
          mid: 'ig-mid-media',
          attachments: [
            { type: 'image', payload: { url: 'https://cdn.example/image.jpg' } },
            { type: 'video', payload: { url: 'https://cdn.example/video.mp4' } },
            { type: 'audio', payload: { url: 'https://cdn.example/audio.m4a' } },
          ],
        },
      }],
    }],
  });

  assert.equal(message.message_type, 'image');
  assert.deepEqual(message.attachments, [
    { type: 'image', url: 'https://cdn.example/image.jpg' },
    { type: 'video', url: 'https://cdn.example/video.mp4' },
    { type: 'audio', url: 'https://cdn.example/audio.m4a' },
  ]);
});

test('Instagram persiste adjuntos desconocidos con fallback estable', () => {
  const [message] = normalizeMetaInstagram({
    object: 'instagram',
    entry: [{
      id: '17841419477422736',
      messaging: [{
        sender: { id: 'ig-customer-3' },
        recipient: { id: '17841419477422736' },
        message: {
          mid: 'ig-mid-unsupported',
          attachments: [{ type: 'share', payload: { title: 'Publicación' } }],
        },
      }],
    }],
  });

  assert.equal(message.message_type, 'share');
  assert.deepEqual(message.attachments, [{ type: 'unsupported' }]);
});

test('Instagram marca ecos de la cuenta profesional como salida humana', () => {
  const [message] = normalizeMetaInstagram({
    object: 'instagram',
    entry: [{
      id: '17841419477422736',
      messaging: [{
        sender: { id: '17841419477422736' },
        recipient: { id: 'ig-customer-4' },
        message: { mid: 'ig-mid-echo', text: 'Respuesta humana', is_echo: true },
      }],
    }],
  });

  assert.equal(message.external_thread_id, 'ig-customer-4');
  assert.equal(message.direction, 'outbound');
  assert.equal(message.sender_type, 'human');
});

test('envío real permanece bloqueado por la política actual salvo habilitación explícita', () => {
  const transport = readFileSync(
    new URL('../src/lib/messaging/transports/whatsapp-cloud.ts', import.meta.url),
    'utf8',
  );
  const policy = readFileSync(
    new URL('../src/lib/messaging/capability-policy.ts', import.meta.url),
    'utf8',
  );
  assert.match(transport, /resolveWhatsAppSendMode/);
  assert.match(transport, /evaluateMessagingCapability/);
  assert.match(transport, /createWhatsAppCloudSender/);
  assert.match(policy, /read_only/);
  assert.match(policy, /disabled/);
  assert.match(policy, /live/);
});

test('migración omnicanal permanece transaccional, aditiva y con IA apagada', () => {
  const source = readFileSync(
    new URL('../supabase/migracion-omnichannel-commerce-core.sql', import.meta.url),
    'utf8',
  );
  assert.match(source, /^begin;/im);
  assert.match(source, /^commit;/im);
  assert.doesNotMatch(source, /\b(drop\s+table|drop\s+column|truncate|delete\s+from)\b/i);
  assert.match(source, /automatic_ai_enabled\s+boolean\s+not\s+null\s+default\s+false/i);
  assert.match(source, /automatic_ai_enabled=false/i);
});
