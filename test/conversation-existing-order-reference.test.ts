import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  customerMessagesMentionAmount,
  findCustomerReferencedOrderId,
} from '../src/lib/orders/conversation-order-reference.ts';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

test('parses the exact order number only from customer messages', () => {
  assert.equal(findCustomerReferencedOrderId([
    { direction: 'outbound', body: 'Tu pedido #99 está listo' },
    { direction: 'inbound', body: 'Hola! Quiero confirmar mi pedido #33 por $31.900' },
  ]), 33);
});

test('recognizes Chilean amount formatting for cross-channel proof', () => {
  const messages = [{ direction: 'inbound', body: 'Pedido 26 de $50.400, te transfiero?' }];
  assert.equal(customerMessagesMentionAmount(messages, 50_400), true);
  assert.equal(customerMessagesMentionAmount(messages, 31_900), false);
});

test('a phone number alone is not accepted as proof for a different total', () => {
  const messages = [{ direction: 'inbound', body: 'Mi teléfono es 956944575' }];
  assert.equal(customerMessagesMentionAmount(messages, 18_900), false);
});

test('WhatsApp links same-customer explicit references before AI extraction', () => {
  const source = read('src/lib/orders/whatsapp-auto-sale.ts');
  assert.match(source, /linkExplicitReferencedOrder/);
  assert.match(source, /allowCrossCustomerWithMatchingAmount:\s*false/);
  assert.ok(source.indexOf('linkExplicitReferencedOrder') < source.lastIndexOf('prepareConversationSaleDraft'));
});

test('Instagram permits cross-identity linking only with exact amount proof', () => {
  const source = read('src/lib/orders/instagram-auto-sale.ts');
  const helper = read('src/lib/orders/conversation-existing-order.ts');
  assert.match(source, /allowCrossCustomerWithMatchingAmount:\s*true/);
  assert.match(helper, /customerMessagesMentionAmount/);
  assert.match(helper, /if \(!sameCustomer && !crossCustomerProof\) return null/);
});
