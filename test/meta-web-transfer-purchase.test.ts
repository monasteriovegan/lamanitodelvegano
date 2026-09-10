import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('Meta Purchase sender rejects paid orders that did not originate on the web', () => {
  const capi = read('src/lib/meta/conversions-api.ts');

  assert.match(capi, /source_channel/);
  assert.match(capi, /not_web_order/);
  assert.match(capi, /String\(order\.source_channel[^\n]*\)\.toLowerCase\(\)/);
});

test('explicit admin payment confirmation syncs a paid web order to Meta CAPI best-effort', () => {
  const actions = read('src/app/admin/pedidos/actions.ts');

  assert.match(actions, /syncPaidWebPurchaseToMeta/);
  assert.match(actions, /confirmarPagoPedido[\s\S]*syncPaidWebPurchaseToMeta\(db,\s*id/);
});

test('operator payment confirmation phrase syncs its linked web order to Meta CAPI best-effort', () => {
  const confirmation = read('src/lib/orders/admin-payment-confirmation.ts');

  assert.match(confirmation, /syncPaidWebPurchaseToMeta/);
  assert.match(confirmation, /syncPaidWebPurchaseToMeta\(db,\s*input\.orderId/);
});

test('full order editor syncs when an order is saved as paid', () => {
  const actions = read('src/app/admin/pedidos/actions.ts');

  assert.match(actions, /paymentStatus === 'paid'[\s\S]*syncPaidWebPurchaseToMeta\(db,\s*id/);
});
