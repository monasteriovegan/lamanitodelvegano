import assert from 'node:assert/strict';
import test from 'node:test';
import { validateMercadoPagoWebhookSignature } from '../src/lib/payments/mercadopago-webhook-signature.ts';
import { hasValidCronAuthorization } from '../src/lib/security/cron-authorization.ts';

const validSignature = 'ts=1704908010,v1=b9619be3eed8f34ec0ec1223945b2d19a25ba8437144a7347922241f67839547';

test('Mercado Pago webhook verification fails closed when its secret is missing', () => {
  assert.equal(validateMercadoPagoWebhookSignature({
    signature: validSignature,
    requestId: 'req-abc',
    dataId: '123456',
    secret: '',
  }), false);
});

test('Mercado Pago webhook verification accepts only the matching HMAC manifest', () => {
  const input = {
    signature: validSignature,
    requestId: 'req-abc',
    dataId: '123456',
    secret: 'test-webhook-secret',
  };
  assert.equal(validateMercadoPagoWebhookSignature(input), true);
  assert.equal(validateMercadoPagoWebhookSignature({ ...input, signature: null }), false);
  assert.equal(validateMercadoPagoWebhookSignature({ ...input, dataId: '654321' }), false);
});

test('cron authorization fails closed and accepts only the exact configured bearer token', () => {
  assert.equal(hasValidCronAuthorization('Bearer expected', ''), false);
  assert.equal(hasValidCronAuthorization(null, 'expected'), false);
  assert.equal(hasValidCronAuthorization('Bearer wrong', 'expected'), false);
  assert.equal(hasValidCronAuthorization('Bearer expected', 'expected'), true);
});
