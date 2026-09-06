import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveCommerceStage } from '../src/lib/ai/remy-commerce-state.ts';

const baseCheckout = {
  nombre: null,
  direccion: null,
  comuna: null,
  phone: null,
  email: null,
  zonaId: null,
  deliveryDate: null,
  paymentMethod: null,
};

test('commerce stage starts at discover with an empty cart', () => {
  assert.equal(resolveCommerceStage({ itemsCount: 0, checkout: baseCheckout }), 'discover');
});

test('cart stage is used after products exist but checkout has not started', () => {
  assert.equal(resolveCommerceStage({ itemsCount: 2, checkout: baseCheckout }), 'cart');
});

test('delivery stage is used while fulfillment data is incomplete', () => {
  assert.equal(resolveCommerceStage({
    itemsCount: 2,
    checkout: { ...baseCheckout, comuna: 'Providencia' },
  }), 'delivery');
});

test('details stage is used once delivery is chosen but customer/payment data is incomplete', () => {
  assert.equal(resolveCommerceStage({
    itemsCount: 2,
    checkout: {
      ...baseCheckout,
      direccion: 'Av. Siempre Viva 123',
      comuna: 'Providencia',
      zonaId: 'zone-1',
      deliveryDate: '2026-09-12',
    },
  }), 'details');
});

test('complete checkout reaches review before any order exists', () => {
  assert.equal(resolveCommerceStage({
    itemsCount: 2,
    checkout: {
      ...baseCheckout,
      nombre: 'Josefa',
      direccion: 'Av. Siempre Viva 123',
      comuna: 'Providencia',
      phone: '+56911111111',
      zonaId: 'zone-1',
      deliveryDate: '2026-09-12',
      paymentMethod: 'mercadopago',
    },
  }), 'review');
});

test('created order moves to confirmed until payment evidence exists', () => {
  assert.equal(resolveCommerceStage({
    itemsCount: 2,
    checkout: { ...baseCheckout, paymentMethod: 'mercadopago' },
    orderId: '42',
  }), 'confirmed');
});

test('payment link evidence moves an online order to payment', () => {
  assert.equal(resolveCommerceStage({
    itemsCount: 2,
    checkout: { ...baseCheckout, paymentMethod: 'mercadopago' },
    orderId: '42',
    paymentUrl: 'https://example.test/pay/42',
  }), 'payment');
});

test('paid order is always post_sale', () => {
  assert.equal(resolveCommerceStage({
    itemsCount: 0,
    checkout: baseCheckout,
    orderId: '42',
    paymentStatus: 'paid',
  }), 'post_sale');
});
