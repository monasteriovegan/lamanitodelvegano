import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const checkoutPage = readFileSync(new URL('../src/app/checkout/page.tsx', import.meta.url), 'utf8');
const checkoutRoute = readFileSync(new URL('../src/app/api/checkout/route.ts', import.meta.url), 'utf8');
const conversationApi = readFileSync(new URL('../src/app/api/admin/conversations/route.ts', import.meta.url), 'utf8');
const conversationUi = readFileSync(new URL('../src/app/admin/conversaciones/ConversationsClient.tsx', import.meta.url), 'utf8');
const manualPage = readFileSync(new URL('../src/app/admin/pedidos/nuevo/page.tsx', import.meta.url), 'utf8');
const manualForm = readFileSync(new URL('../src/app/admin/pedidos/nuevo/ManualOrderForm.tsx', import.meta.url), 'utf8');
const orderActions = readFileSync(new URL('../src/app/admin/pedidos/actions.ts', import.meta.url), 'utf8');
const orderEditor = readFileSync(new URL('../src/app/admin/pedidos/[id]/OrderEditForm.tsx', import.meta.url), 'utf8');

test('checkout resumes the same pending web order when payment channel changes', () => {
  assert.match(checkoutPage, /lmv_pending_checkout/);
  assert.match(checkoutPage, /resumePedidoId/);
  assert.match(checkoutRoute, /resumePedidoId/);
  assert.match(checkoutRoute, /resumeCheckoutOrder/);
  assert.match(checkoutRoute, /payment_status[^\n]*pending/);
  assert.match(checkoutRoute, /metodopago:\s*body\.metodoPago/);
});

test('conversation inbox exposes the linked order and offers one canonical sale action', () => {
  assert.match(conversationApi, /order_id/);
  assert.match(conversationApi, /orderId:\s*row\.order_id/);
  assert.match(conversationUi, /Registrar venta/);
  assert.match(conversationUi, /Ver pedido #/);
  assert.match(conversationUi, /conversationId=/);
});

test('manual order creator can create through the conversation transaction', () => {
  assert.match(manualPage, /conversationId/);
  assert.match(manualForm, /conversationId/);
  assert.match(orderActions, /createConversationOrder\(/);
  assert.match(orderActions, /conversationId/);
  assert.match(orderActions, /conversation_already_has_order/);
});

test('admin has an explicit audited confirm-payment action', () => {
  assert.match(orderActions, /export async function confirmarPagoPedido/);
  assert.match(orderActions, /payment_status:\s*'paid'/);
  assert.match(orderActions, /status:\s*'confirmed'/);
  assert.match(orderEditor, /Confirmar pago/);
  assert.match(orderEditor, /confirmarPagoPedido/);
});
