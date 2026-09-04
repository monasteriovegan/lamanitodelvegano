import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('checkout readiness is attested against the live reconciled schema instead of a stale manual flag', () => {
  const route = read('src/app/api/checkout/route.ts');
  const readiness = read('src/lib/repositories/checkout-schema-readiness.ts');
  const migration = read('supabase/migrations/20260904040000_checkout_production_readiness.sql');

  assert.match(route, /verifyCheckoutSchemaReady/);
  assert.doesNotMatch(route, /SUPABASE_CHECKOUT_SCHEMA_READY/);
  assert.match(readiness, /checkout_schema_ready_v2/);
  assert.match(migration, /create or replace function public\.checkout_schema_ready_v2/i);
  assert.match(migration, /revoke all on function public\.checkout_schema_ready_v2/i);
  assert.match(migration, /grant execute on function public\.checkout_schema_ready_v2/i);
});

test('checkout captures and persists comuna, delivery date and customer notes', () => {
  const page = read('src/app/checkout/page.tsx');
  const route = read('src/app/api/checkout/route.ts');
  const repo = read('src/lib/repositories/orders-repository.ts');
  const migration = read('supabase/migrations/20260904040000_checkout_production_readiness.sql');

  assert.match(page, /const \[comuna, setComuna\]/);
  assert.match(page, /const \[fechaEntrega, setFechaEntrega\]/);
  assert.match(page, /cliente:\s*\{\s*nombre,\s*direccion,\s*comuna,\s*telefono,\s*email\s*\}/s);
  assert.match(page, /fechaEntrega/);
  assert.match(route, /comuna:\s*body\.cliente\.comuna/);
  assert.match(route, /deliveryDate:\s*body\.fechaEntrega/);
  assert.match(repo, /p_delivery_date:\s*input\.deliveryDate/);
  assert.match(migration, /add column if not exists notas text/i);
});

test('Mercado Pago charges exactly the persisted server-side order total, including discounts', () => {
  const payment = read('src/lib/payments/payment-link.ts');
  assert.match(payment, /title:\s*`Pedido #\$\{pedido\.id\}/);
  assert.match(payment, /quantity:\s*1/);
  assert.match(payment, /unit_price:\s*Number\(pedido\.total\)/);
  assert.doesNotMatch(payment, /unit_price:\s*Number\(item\.precio/);
});

test('confirmation page uses the real pedidos schema and integer ids safely', () => {
  const page = read('src/app/pedido/[id]/page.tsx');
  assert.match(page, /estado/);
  assert.doesNotMatch(page, /\bstatus\b/);
  assert.doesNotMatch(page, /\bcliente\b/);
  assert.match(page, /String\(pedido\.id\)/);
  assert.match(page, /pedido\.estado === 'Pagado' && pedido\.payment_status === 'paid'/);
});

test('Purchase is created only after paid and CAPI retries are idempotent', () => {
  const webhook = read('src/app/api/pagos/mercadopago-webhook/route.ts');
  const capi = read('src/lib/meta/conversions-api.ts');
  const migration = read('supabase/migrations/20260904040000_checkout_production_readiness.sql');

  assert.match(migration, /InitiateCheckout/);
  assert.match(migration, /event_name\s*=\s*'Purchase'/i);
  assert.match(capi, /purchase_\$\{order\.id\}/);
  assert.match(capi, /status[^\n]*sent/);
  assert.match(capi, /status[^\n]*failed/);
  assert.match(webhook, /effectiveStatus === 'paid'/);
  assert.match(webhook, /sendPaidPurchaseToMeta/);
});

test('Pixel and CAPI share the same deterministic Purchase event id', () => {
  const browser = read('src/lib/analytics/client.ts');
  const capi = read('src/lib/meta/conversions-api.ts');
  assert.match(browser, /const eventId = `purchase_\$\{orderId\}`/);
  assert.match(capi, /const eventId = `purchase_\$\{order\.id\}`/);
  assert.match(browser, /eventID:\s*eventId/);
  assert.match(capi, /event_id:\s*eventId/);
});
