import assert from 'node:assert/strict';
import {
  createDecipheriv,
  createECDH,
  createHmac,
  randomBytes,
} from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  buildOrderPaidPushPayload,
  encryptWebPushPayload,
  isAllowedPushEndpoint,
  isExpiredPushStatus,
  isSafeAdminDeepLink,
} from '../src/lib/notifications/web-push.ts';

const adminLayout = readFileSync('src/app/admin/layout.tsx', 'utf8');
const adminManifest = readFileSync('src/app/admin/manifest.webmanifest/route.ts', 'utf8');
const rootWorker = readFileSync('public/wonka-sw.js', 'utf8');
const adminWorker = readFileSync('src/app/admin/wonka-sw.js/route.ts', 'utf8');
const auth = readFileSync('src/lib/supabase/server-auth.ts', 'utf8');
const webhook = readFileSync('src/app/api/pagos/mercadopago-webhook/route.ts', 'utf8');
const migration = readFileSync('supabase/migrations/20260906003000_admin_web_push.sql', 'utf8');
const subscriptionsRoute = readFileSync('src/app/api/admin/push/subscriptions/route.ts', 'utf8');
const testRoute = readFileSync('src/app/api/admin/push/test/route.ts', 'utf8');

function hmacSha256(key: Buffer, value: Buffer): Buffer {
  return createHmac('sha256', key).update(value).digest();
}

function hkdfExpand(prk: Buffer, info: Buffer, length: number): Buffer {
  const chunks: Buffer<ArrayBufferLike>[] = [];
  let previous: Buffer<ArrayBufferLike> = Buffer.alloc(0);
  let counter = 1;
  while (Buffer.concat(chunks).length < length) {
    previous = hmacSha256(prk, Buffer.concat([previous, info, Buffer.from([counter])]));
    chunks.push(previous);
    counter += 1;
  }
  return Buffer.concat(chunks).subarray(0, length);
}

test('admin manifest remains isolated to /admin and public root manifest is not reintroduced', () => {
  assert.match(adminLayout, /manifest:\s*['"]\/admin\/manifest\.webmanifest['"]/);
  assert.match(adminManifest, /start_url:\s*['"]\/admin['"]/);
  assert.match(adminManifest, /scope:\s*['"]\/admin['"]/);
});

test('legacy root worker only retires itself and does not intercept public fetches', () => {
  assert.match(rootWorker, /registration\.unregister\(\)/);
  assert.doesNotMatch(rootWorker, /addEventListener\(['"]fetch['"]/);
  assert.doesNotMatch(rootWorker, /cache\.put\(/);
});

test('admin worker handles real push and notification click under admin scope', () => {
  assert.match(adminWorker, /addEventListener\(['"]push['"]/);
  assert.match(adminWorker, /showNotification/);
  assert.match(adminWorker, /addEventListener\(['"]notificationclick['"]/);
  assert.match(adminWorker, /openWindow/);
  assert.doesNotMatch(adminWorker, /addEventListener\(['"]fetch['"]/);
});

test('push payload contains useful order facts but no customer PII', () => {
  const payload = buildOrderPaidPushPayload({
    numeric_id: 148,
    order_number: 'MAN-148',
    total: 24900,
    delivery_date: '2026-09-15',
  });
  assert.equal(payload.title, '🛍️ Nueva venta — La Manito');
  assert.match(payload.body, /Pedido #148 · \$24\.900/);
  assert.match(payload.body, /Pago aprobado ✅/);
  assert.match(payload.body, /15 de septiembre/);
  assert.equal(payload.url, '/admin/pedidos/148');
  const serialized = JSON.stringify(payload);
  assert.doesNotMatch(serialized, /direccion|tel[eé]fono|email|customer/i);
});

test('aes128gcm Web Push record decrypts back to the exact payload with subscriber key material', () => {
  const subscriber = createECDH('prime256v1');
  subscriber.generateKeys();
  const subscriberPublicKey = subscriber.getPublicKey();
  const authSecret = randomBytes(16);
  const payload = buildOrderPaidPushPayload({
    numeric_id: 148,
    total: 24900,
    delivery_date: '2026-09-15',
  });

  const body = encryptWebPushPayload({
    endpoint: 'https://fcm.googleapis.com/fcm/send/test-only',
    keys: {
      p256dh: subscriberPublicKey.toString('base64url'),
      auth: authSecret.toString('base64url'),
    },
  }, payload);

  const salt = body.subarray(0, 16);
  assert.equal(body.readUInt32BE(16), 4096);
  const serverKeyLength = body[20];
  assert.equal(serverKeyLength, 65);
  const serverPublicKey = body.subarray(21, 21 + serverKeyLength);
  const encryptedRecord = body.subarray(21 + serverKeyLength);
  const sharedSecret = subscriber.computeSecret(serverPublicKey);

  const prkKey = hmacSha256(authSecret, sharedSecret);
  const keyInfo = Buffer.concat([
    Buffer.from('WebPush: info\0', 'utf8'),
    subscriberPublicKey,
    serverPublicKey,
  ]);
  const ikm = hkdfExpand(prkKey, keyInfo, 32);
  const prk = hmacSha256(salt, ikm);
  const cek = hkdfExpand(prk, Buffer.from('Content-Encoding: aes128gcm\0', 'utf8'), 16);
  const nonce = hkdfExpand(prk, Buffer.from('Content-Encoding: nonce\0', 'utf8'), 12);

  const ciphertext = encryptedRecord.subarray(0, encryptedRecord.length - 16);
  const tag = encryptedRecord.subarray(encryptedRecord.length - 16);
  const decipher = createDecipheriv('aes-128-gcm', cek, nonce, { authTagLength: 16 });
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  assert.equal(plaintext[plaintext.length - 1], 2);
  assert.deepEqual(JSON.parse(plaintext.subarray(0, -1).toString('utf8')), payload);
});

test('push endpoints are restricted to known browser push providers, not arbitrary HTTPS SSRF targets', () => {
  assert.equal(isAllowedPushEndpoint('https://fcm.googleapis.com/fcm/send/abc'), true);
  assert.equal(isAllowedPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/abc'), true);
  assert.equal(isAllowedPushEndpoint('https://web.push.apple.com/QP/abc'), true);
  assert.equal(isAllowedPushEndpoint('https://example.com/fcm/send/abc'), false);
  assert.equal(isAllowedPushEndpoint('https://127.0.0.1/admin'), false);
});

test('push deep links are limited to the admin origin path', () => {
  assert.equal(isSafeAdminDeepLink('/admin/pedidos/148'), true);
  assert.equal(isSafeAdminDeepLink('/admin'), true);
  assert.equal(isSafeAdminDeepLink('/'), false);
  assert.equal(isSafeAdminDeepLink('https://evil.example/admin'), false);
  assert.equal(isSafeAdminDeepLink('//evil.example/admin'), false);
});

test('404 and 410 expire a browser push subscription', () => {
  assert.equal(isExpiredPushStatus(404), true);
  assert.equal(isExpiredPushStatus(410), true);
  assert.equal(isExpiredPushStatus(429), false);
  assert.equal(isExpiredPushStatus(500), false);
});

test('admin role resolution fails closed instead of inventing admin on DB error', () => {
  assert.doesNotMatch(auth, /rolError[\s\S]{0,400}rol:\s*['"]admin['"]/);
});

test('mutating push APIs enforce same-origin requests and cannot take over another admin endpoint', () => {
  assert.match(subscriptionsRoute, /requireSameOrigin/);
  assert.match(testRoute, /requireSameOrigin/);
  assert.match(subscriptionsRoute, /existing[\s\S]+user_id[\s\S]+endpoint_owned_by_another_user/);
});

test('push schema is RLS-protected and paid deliveries are idempotent per subscription', () => {
  assert.match(migration, /create table[^;]+admin_push_subscriptions/i);
  assert.match(migration, /create table[^;]+admin_notification_deliveries/i);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /unique index[\s\S]+order_paid[\s\S]+order_id[\s\S]+subscription_id/i);
});

test('Mercado Pago invokes admin order-paid notification only from the CAS transition winner and keeps CAPI', () => {
  assert.match(webhook, /if \(updatedOrder\)[\s\S]+notifyOrderPaid/);
  assert.match(webhook, /notifyOrderPaid[\s\S]+catch/);
  assert.match(webhook, /sendPaidPurchaseToMeta\(db, pedidoId\)/);
});
