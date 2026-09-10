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
const orderList = readFileSync(new URL('../src/app/admin/pedidos/page.tsx', import.meta.url), 'utf8');
const orderDetail = readFileSync(new URL('../src/app/admin/pedidos/[id]/page.tsx', import.meta.url), 'utf8');
const orderRepository = readFileSync(new URL('../src/lib/repositories/orders-repository.ts', import.meta.url), 'utf8');
const whatsappRoute = readFileSync(new URL('../src/app/api/whatsapp/route.ts', import.meta.url), 'utf8');
const orderReference = readFileSync(new URL('../src/lib/orders/whatsapp-order-reference.ts', import.meta.url), 'utf8');
const adminSend = readFileSync(new URL('../src/app/api/admin/messages/send/route.ts', import.meta.url), 'utf8');
const paymentConfirmation = readFileSync(new URL('../src/lib/orders/admin-payment-confirmation.ts', import.meta.url), 'utf8');
const productEditPage = readFileSync(new URL('../src/app/admin/productos/[id]/page.tsx', import.meta.url), 'utf8');
const availabilityEditor = readFileSync(new URL('../src/app/admin/productos/AvailabilityDatesEditor.tsx', import.meta.url), 'utf8');
const availabilityActions = readFileSync(new URL('../src/app/admin/productos/availability-actions.ts', import.meta.url), 'utf8');

test('checkout resumes the same pending web order when payment channel changes', () => {
  assert.match(checkoutPage, /lmv_pending_checkout/);
  assert.match(checkoutPage, /resumePedidoId/);
  assert.match(checkoutRoute, /resumePedidoId/);
  assert.match(checkoutRoute, /resumeCheckoutOrder/);
  assert.match(checkoutRoute, /payment_status[^\n]*pending/);
  assert.match(checkoutRoute, /metodopago:\s*input\.paymentMethod|metodopago:\s*body\.metodoPago/);
});

test('WhatsApp confirmation references link back to the existing web order', () => {
  assert.match(orderReference, /pedido\\s\*#|pedido\\s\*#\\s\*/);
  assert.match(orderReference, /source_channel/);
  assert.match(orderReference, /customer_id/);
  assert.match(orderReference, /conversation_orders/);
  assert.match(whatsappRoute, /reconcileWhatsappOrderReference/);
});

test('conversation inbox exposes the linked order and offers one canonical sale action', () => {
  assert.match(conversationApi, /order_id/);
  assert.match(conversationApi, /orderId:\s*row\.order_id/);
  assert.match(conversationUi, /Registrar venta/);
  assert.match(conversationUi, /Ver pedido #/);
  assert.match(conversationUi, /conversationId=/);
});

test('manual order creator is securely prefilled and uses the conversation transaction', () => {
  assert.match(manualPage, /searchParams/);
  assert.match(manualPage, /conversationId/);
  assert.match(manualPage, /initialContext/);
  assert.match(manualForm, /initialContext/);
  assert.match(manualForm, /conversationId:\s*initialContext/);
  assert.match(orderActions, /createConversationOrder\(/);
  assert.match(orderActions, /conversation_already_has_order/);
});

test('admin has an explicit audited confirm-payment button', () => {
  assert.match(orderActions, /export async function confirmarPagoPedido/);
  assert.match(orderActions, /payment_status:\s*'paid'/);
  assert.match(orderActions, /status:\s*'confirmed'/);
  assert.match(orderEditor, /Confirmar pago/);
  assert.match(orderEditor, /confirmarPagoPedido/);
});

test('operator payment phrases confirm only a linked order from the authenticated send path', () => {
  assert.match(paymentConfirmation, /pago confirmado/);
  assert.match(paymentConfirmation, /deposito confirmado/);
  assert.match(paymentConfirmation, /transferencia confirmada/);
  assert.match(paymentConfirmation, /payment_status:\s*'paid'/);
  assert.match(adminSend, /applyAdminPaymentConfirmation/);
  assert.match(adminSend, /sender_type:\s*'human'/);
  assert.doesNotMatch(whatsappRoute, /applyAdminPaymentConfirmation/);
});

test('operator payment confirmation records transfer as the real payment method', () => {
  assert.match(paymentConfirmation, /payment_method:\s*'transfer'|metodopago:\s*'transfer'/);
  assert.match(orderRepository, /payment_method\?:\s*string/);
  assert.match(orderRepository, /update\.metodopago\s*=\s*input\.payment_method/);
});

test('explicit confirm-payment action requires and persists the real payment method', () => {
  assert.match(orderActions, /confirmarPagoPedido\(id:\s*string,\s*paymentMethod/);
  assert.match(orderActions, /payment_method:\s*paymentMethod/);
  assert.match(orderEditor, /Medio de pago recibido/);
  assert.match(orderEditor, /value="transfer"/);
  assert.match(orderEditor, /value="mercadopago"/);
  assert.match(orderEditor, /value="cash"/);
  assert.match(orderEditor, /value="card"/);
  assert.match(orderEditor, /value="other"/);
});

test('orders list and detail show payment status and real payment method separately from channel', () => {
  assert.match(orderList, /paymentMethodLabel/);
  assert.match(orderList, /o\.payment_method/);
  assert.match(orderDetail, /paymentMethodLabel/);
  assert.match(orderDetail, /order\.payment_method/);
  assert.match(orderDetail, /Canal:/);
});

test('product admin exposes delivery availability dates and persists them server-side', () => {
  assert.match(productEditPage, /AvailabilityDatesEditor/);
  assert.match(availabilityEditor, /Fechas disponibles para entrega/);
  assert.match(availabilityEditor, /type="date"/);
  assert.match(availabilityActions, /disponibilidad/);
  assert.match(availabilityActions, /requireRole\(\['admin', 'bodega'\]\)/);
});
