import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  normalizeBaileys,
  normalizeMetaWhatsApp,
  normalizePhone,
} from '../src/lib/messaging/normalize.ts';
import { verifyHmac } from '../src/lib/messaging/signature.ts';

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

test('webhook inbound delega en Remy sin invocar proveedores LLM directamente', () => {
  const source = readFileSync(
    new URL('../src/app/api/whatsapp/route.ts', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(source, /gemini|openai|anthropic|claude|generarRespuesta/i);
  assert.match(source, /import \{ maybeAutoReply \} from '@\/lib\/ai\/remy'/);
  assert.match(source, /!result\.duplicate && !isStatus && !isAppEcho && message\.direction === 'inbound'/);
  assert.match(source, /const ai = await maybeAutoReply\(db, result, message\)/);
  assert.match(source, /ai_called:\s*aiCalled > 0/);
  assert.match(source, /ai_replied:\s*aiReplied > 0/);
});

test('envío real permanece bloqueado salvo habilitación explícita', () => {
  const source = readFileSync(
    new URL('../src/lib/messaging/transports/whatsapp-cloud.ts', import.meta.url),
    'utf8',
  );
  assert.match(source, /META_SEND_MODE !== 'live'/);
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
