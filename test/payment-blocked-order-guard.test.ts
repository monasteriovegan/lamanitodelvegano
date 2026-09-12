import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { isCancelledOrderState } from '../src/lib/payments/order-payment-eligibility.ts';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

test('cancelled order states are normalized safely', () => {
  assert.equal(isCancelledOrderState('Cancelado'), true);
  assert.equal(isCancelledOrderState('cancelled'), true);
  assert.equal(isCancelledOrderState('Pagado'), false);
});

test('payment-link checks delivery eligibility before reusing an old Mercado Pago preference', () => {
  const source = read('src/lib/payments/payment-link.ts');
  const eligibilityIndex = source.indexOf('getOrderPaymentEligibility(db, pedido)');
  const existingPreferenceIndex = source.indexOf('existingMercadoPagoPreference(token, pedido.external_token)');
  assert.ok(eligibilityIndex > 0);
  assert.ok(existingPreferenceIndex > eligibilityIndex);
  assert.match(source, /payment_order_ineligible/);
});

test('Mercado Pago approved payment for an ineligible order is quarantined instead of operationally resurrected', () => {
  const source = read('src/app/api/pagos/mercadopago-webhook/route.ts');
  assert.match(source, /nextPaymentStatus === 'paid' && !eligibility\.eligible/);
  assert.match(source, /payment_reconciliation_queue/);
  assert.match(source, /payment_status: 'paid'/);
  assert.match(source, /reconciliation_required: true/);

  const quarantineStart = source.indexOf("if (nextPaymentStatus === 'paid' && !eligibility.eligible)");
  const normalPurchase = source.lastIndexOf('sendPaidPurchaseToMeta(db, pedidoId)');
  assert.ok(quarantineStart > 0 && normalPurchase > quarantineStart);
  const quarantineBlock = source.slice(quarantineStart, normalPurchase);
  assert.doesNotMatch(quarantineBlock, /estado\s*:\s*['"]Pagado['"]/);
});
