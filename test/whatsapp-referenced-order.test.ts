import assert from 'node:assert/strict';
import test from 'node:test';
import { findCustomerReferencedOrderId } from '../src/lib/orders/whatsapp-auto-sale-signals.ts';

test('finds an explicit customer reference like pedido #33', () => {
  assert.equal(findCustomerReferencedOrderId([
    { id: '1', direction: 'inbound', body: 'Hola! Quiero confirmar mi pedido #33 por $31.900', payload: {} },
  ]), 33);
});

test('ignores order numbers mentioned only by the business', () => {
  assert.equal(findCustomerReferencedOrderId([
    { id: '1', direction: 'outbound', body: 'Tu pedido #33 está listo', payload: { sender_type: 'human' } },
  ]), null);
});

test('uses the latest explicit customer order reference when multiple cycles exist', () => {
  assert.equal(findCustomerReferencedOrderId([
    { id: '1', direction: 'inbound', body: 'pedido #28', payload: {} },
    { id: '2', direction: 'inbound', body: 'ahora quiero confirmar pedido 41', payload: {} },
  ]), 41);
});
