import assert from 'node:assert/strict';
import test from 'node:test';

import { evaluateRemyToolEvidence } from '../src/lib/ai/remy-tool-evidence.ts';

test('cart mutations only count as successful with ok=true', () => {
  assert.equal(evaluateRemyToolEvidence('cart_add', { ok: true }).success, true);
  assert.equal(evaluateRemyToolEvidence('cart_remove', { ok: false }).success, false);
  assert.equal(evaluateRemyToolEvidence('cart_clear', {}).success, false);
});

test('order creation requires both ok=true and an order id', () => {
  assert.equal(evaluateRemyToolEvidence('order_create', { ok: true, orderId: '123' }).success, true);
  assert.equal(evaluateRemyToolEvidence('order_create', { ok: true }).success, false);
});

test('payment link requires both ok=true and a non-empty URL', () => {
  assert.equal(evaluateRemyToolEvidence('payment_link', { ok: true, paymentUrl: 'https://pay.test/123' }).success, true);
  assert.equal(evaluateRemyToolEvidence('payment_link', { ok: true, paymentUrl: '' }).success, false);
});

test('read-only tools are not classified as side effects', () => {
  const evidence = evaluateRemyToolEvidence('catalog_search', { products: [] });
  assert.equal(evidence.sideEffect, false);
  assert.equal(evidence.success, true);
});
