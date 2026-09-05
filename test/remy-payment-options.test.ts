import assert from 'node:assert/strict';
import test from 'node:test';

import {
  configuredOnlinePaymentMethods,
  paymentMethodQuestion,
} from '../src/lib/ai/remy-payment-options.ts';

test('Mercado Pago only offers Mercado Pago', () => {
  const methods = configuredOnlinePaymentMethods({ mercadoPagoReady: true, flowReady: false });
  assert.deepEqual(methods, ['mercadopago']);
  assert.match(paymentMethodQuestion(methods), /Mercado Pago/i);
  assert.doesNotMatch(paymentMethodQuestion(methods), /Flow/i);
});

test('Flow only offers Flow', () => {
  const methods = configuredOnlinePaymentMethods({ mercadoPagoReady: false, flowReady: true });
  assert.deepEqual(methods, ['flow']);
  assert.match(paymentMethodQuestion(methods), /Flow/i);
  assert.doesNotMatch(paymentMethodQuestion(methods), /Mercado Pago/i);
});

test('both configured gateways are offered and no transfer is invented', () => {
  const methods = configuredOnlinePaymentMethods({ mercadoPagoReady: true, flowReady: true });
  const question = paymentMethodQuestion(methods);
  assert.deepEqual(methods, ['mercadopago', 'flow']);
  assert.match(question, /Mercado Pago/i);
  assert.match(question, /Flow/i);
  assert.doesNotMatch(question, /transfer/i);
});

test('no online gateway fails closed to WhatsApp coordination', () => {
  assert.deepEqual(configuredOnlinePaymentMethods({ mercadoPagoReady: false, flowReady: false }), []);
  assert.match(paymentMethodQuestion([]), /WhatsApp|persona|equipo/i);
  assert.doesNotMatch(paymentMethodQuestion([]), /cuenta bancaria|RUT|banco/i);
});
