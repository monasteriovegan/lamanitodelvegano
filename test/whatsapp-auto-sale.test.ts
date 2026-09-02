import assert from 'node:assert/strict';
import test from 'node:test';

import { shouldAttemptWhatsappAutoSale } from '../src/lib/orders/whatsapp-auto-sale-signals.ts';

function inbound(text: string, overrides: Record<string, unknown> = {}) {
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

test('ignores empty or missing text', () => {
  assert.equal(shouldAttemptWhatsappAutoSale(inbound('')), false);
  assert.equal(shouldAttemptWhatsappAutoSale(inbound('   ')), false);
});

test('ignores non-text message types (e.g. images, stickers)', () => {
  assert.equal(shouldAttemptWhatsappAutoSale(inbound('confirmo', { message_type: 'image' })), false);
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

test('fires on a payment/transfer mention from the customer', () => {
  assert.equal(shouldAttemptWhatsappAutoSale(inbound('ya hice la transferencia, ahi va el comprobante')), true);
});

test('for outbound (business) messages, only fires on business-side sale language', () => {
  assert.equal(shouldAttemptWhatsappAutoSale(outbound('cualquier cosa me avisas')), false);
  assert.equal(shouldAttemptWhatsappAutoSale(outbound('perfecto, pedido confirmado, gracias!')), true);
});
