import assert from 'node:assert/strict';
import test from 'node:test';

import { shouldAttemptWhatsappAutoSale } from '../src/lib/orders/whatsapp-auto-sale-signals.ts';

function inbound(text: string | null, overrides: Record<string, unknown> = {}) {
  return {
    channel: 'whatsapp',
    direction: 'inbound',
    message_type: 'text',
    text,
    ...overrides,
  } as any;
}

function outbound(text: string, overrides: Record<string, unknown> = {}) {
  return {
    channel: 'whatsapp',
    direction: 'outbound',
    message_type: 'text',
    text,
    ...overrides,
  } as any;
}

test('ignores messages from other channels, even with sale-like text', () => {
  assert.equal(shouldAttemptWhatsappAutoSale(inbound('confirmo el pedido', { channel: 'instagram' })), false);
});

test('ignores empty or missing text when there is no sale-relevant media', () => {
  assert.equal(shouldAttemptWhatsappAutoSale(inbound('')), false);
  assert.equal(shouldAttemptWhatsappAutoSale(inbound('   ')), false);
});

test('retries a pending sale on receipt-like media but ignores unrelated media', () => {
  assert.equal(shouldAttemptWhatsappAutoSale(inbound(null, { message_type: 'image' })), true);
  assert.equal(shouldAttemptWhatsappAutoSale(inbound(null, { message_type: 'document' })), true);
  assert.equal(shouldAttemptWhatsappAutoSale(inbound(null, { message_type: 'sticker' })), false);
});

test('ignores ordinary small talk that has no sale or fulfillment signal', () => {
  assert.equal(shouldAttemptWhatsappAutoSale(inbound('hola, buenas tardes')), false);
  assert.equal(shouldAttemptWhatsappAutoSale(inbound('cuanto se demora el envio normalmente')), false);
});

test('fires on an explicit customer confirmation', () => {
  assert.equal(shouldAttemptWhatsappAutoSale(inbound('dale, confirmo el pedido')), true);
});

test('fires on a customer sharing a delivery address', () => {
  assert.equal(shouldAttemptWhatsappAutoSale(inbound('mi direccion es Av. Providencia 1234, depto 5')), true);
});

test('fires when the customer changes fulfillment to pickup', () => {
  assert.equal(shouldAttemptWhatsappAutoSale(inbound('lo iré a buscar al metro La Moneda')), true);
});

test('fires when customer supplies their name after payment intent', () => {
  assert.equal(shouldAttemptWhatsappAutoSale(inbound('Mi nombre es Josefa Moreno')), true);
});

test('fires on a payment/transfer mention from the customer', () => {
  assert.equal(shouldAttemptWhatsappAutoSale(inbound('ya hice la transferencia, ahi va el comprobante')), true);
});

test('for outbound (business) messages, only fires on business-side sale language', () => {
  assert.equal(shouldAttemptWhatsappAutoSale(outbound('cualquier cosa me avisas')), false);
  assert.equal(shouldAttemptWhatsappAutoSale(outbound('perfecto, pedido confirmado, gracias!')), true);
});
