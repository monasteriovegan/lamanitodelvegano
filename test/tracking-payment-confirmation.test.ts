import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('tracking API uses the reconciled pedidos schema and accepts the generated tracking number', () => {
  const route = read('src/app/api/tracking/route.ts');

  assert.match(route, /tracking_number/);
  assert.match(route, /nombre_cliente/);
  assert.match(route, /shipping_zone_name/);
  assert.match(route, /fecha_entrega/);
  assert.match(route, /metodopago/);
  assert.match(route, /estado/);
  assert.match(route, /created_at/);
  assert.doesNotMatch(route, /\.select\('id, cliente,/);
  assert.match(route, /\.eq\('tracking_number',/);
});

test('tracking page consumes the id query parameter automatically and does not promise a later tracking id', () => {
  const page = read('src/app/seguimiento/page.tsx');

  assert.match(page, /useSearchParams/);
  assert.match(page, /searchParams\.get\('id'\)/);
  assert.match(page, /buscar\(/);
  assert.doesNotMatch(page, /ID que te enviamos al confirmar tu compra/);
  assert.match(page, /número de seguimiento/i);
});

test('Mercado Pago webhook only writes transition history when its compare-and-set payment update wins', () => {
  const webhook = read('src/app/api/pagos/mercadopago-webhook/route.ts');

  assert.match(webhook, /\.eq\('payment_status', currentPaymentStatus\)/);
  assert.match(webhook, /updatedOrder/);
  assert.match(webhook, /if \(updatedOrder\)/);
  assert.match(webhook, /order_status_history/);
});
