import assert from 'node:assert/strict';
import test from 'node:test';

import {
  evaluateRemyToolEvidence,
  requiredRemySideEffect,
} from '../src/lib/ai/remy-tool-evidence.ts';

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

test('explicit side-effect requests map to the operation that must be evidenced', () => {
  assert.equal(requiredRemySideEffect('agrega dos alfajores'), 'cart_add');
  assert.equal(requiredRemySideEffect('quita una empanada'), 'cart_remove');
  assert.equal(requiredRemySideEffect('vacía el carrito'), 'cart_clear');
  assert.equal(requiredRemySideEffect('sí confirmo el pedido'), 'order_create');
  assert.equal(requiredRemySideEffect('mándame el link de pago'), 'payment_link');
});

test('a short yes only requires order creation when the prior assistant asked to confirm the order', () => {
  assert.equal(requiredRemySideEffect('sí', '¿Confirmas que cree el pedido?'), 'order_create');
  assert.equal(requiredRemySideEffect('sí', '¿Quieres que te muestre más sabores?'), null);
});
