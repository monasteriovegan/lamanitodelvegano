import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  fingerprintTrackingClient,
  parsePublicTrackingId,
  toPublicTrackingResponse,
} from '../src/lib/tracking/public-tracking.ts';

test('public tracking rejects sequential order ids and malformed identifiers', () => {
  assert.equal(parsePublicTrackingId('67'), null);
  assert.equal(parsePublicTrackingId('99999999'), null);
  assert.equal(parsePublicTrackingId('LMV-123'), null);
  assert.equal(parsePublicTrackingId('LMV-4E4113E68C!'), null);
});

test('public tracking accepts and normalizes the high-entropy tracking number', () => {
  assert.equal(parsePublicTrackingId('  lmv-4e4113e68c  '), 'LMV-4E4113E68C');
});

test('public tracking response contains only fulfillment fields and no PII', () => {
  const response = toPublicTrackingResponse({
    tracking_number: 'LMV-4E4113E68C',
    estado: 'Despachado',
    fecha_entrega: '2026-09-29',
    id: 67,
    nombre_cliente: 'Persona privada',
    direccion: 'Dirección privada 123',
    telefono: '+56900000000',
    customer_email: 'private@example.com',
    shipping_zone_name: 'Zona privada',
    metodopago: 'mercadopago',
    payment_status: 'paid',
    total: 10900,
    created_at: '2026-09-27T00:00:00.000Z',
  });

  assert.deepEqual(response, {
    trackingNumber: 'LMV-4E4113E68C',
    status: 'Despachado',
    estimatedDelivery: '2026-09-29',
  });
  for (const forbidden of [
    'id',
    'nombreCliente',
    'direccion',
    'telefono',
    'email',
    'zonaEnvio',
    'metodoPago',
    'paymentStatus',
    'total',
    'createdAt',
  ]) {
    assert.equal(Object.hasOwn(response, forbidden), false, `${forbidden} must not be public`);
  }
});

test('tracking client fingerprint is stable, opaque, and does not retain raw client data', () => {
  const first = fingerprintTrackingClient(
    { forwardedFor: '203.0.113.10, 10.0.0.1', userAgent: 'Browser/1.0' },
    'server-only-secret',
  );
  const second = fingerprintTrackingClient(
    { forwardedFor: '203.0.113.10, 10.0.0.1', userAgent: 'Browser/1.0' },
    'server-only-secret',
  );
  const changedUserAgent = fingerprintTrackingClient(
    { forwardedFor: '203.0.113.10, 10.0.0.1', userAgent: 'Evasion-Attempt/2.0' },
    'server-only-secret',
  );

  assert.match(first, /^[a-f0-9]{64}$/);
  assert.equal(first, second);
  assert.equal(first, changedUserAgent, 'changing user-agent must not create a fresh rate-limit bucket');
  assert.doesNotMatch(first, /203\.0\.113\.10|Browser/);
});
