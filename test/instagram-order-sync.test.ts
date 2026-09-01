import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

test('webhook de Instagram intenta registrar una venta cerrada en pedidos canónicos', () => {
  const route = read('src/app/api/instagram/route.ts');

  assert.match(route, /autoRegisterInstagramConversationSale/);
  assert.match(route, /shouldAttemptInstagramAutoSale/);
  assert.match(route, /!result\.duplicate/);
  assert.match(route, /result\.conversationId/);
  assert.match(route, /orders_synced/);
});

test('sincronización automática reutiliza la venta conversacional, evita duplicados y no rompe el webhook', () => {
  const relativePath = 'src/lib/orders/instagram-auto-sale.ts';
  assert.equal(existsSync(join(root, relativePath)), true, 'debe existir el puente Instagram -> pedido canónico');

  const source = read(relativePath);
  assert.match(source, /prepareConversationSaleDraft/);
  assert.match(source, /confirmConversationSale/);
  assert.match(source, /conversation\.order_id/);
  assert.match(source, /draft\.saleDetected/);
  assert.match(source, /draft\.missing\.length/);
  assert.match(source, /paymentEvidence:\s*businessPaymentConfirmed/);
});

test('sincronización automática puede completar teléfono explícito del chat y exige señal comercial', () => {
  const relativePath = 'src/lib/orders/instagram-auto-sale.ts';
  assert.equal(existsSync(join(root, relativePath)), true, 'debe existir el puente Instagram -> pedido canónico');

  const source = read(relativePath);
  assert.match(source, /extractPhoneFromMessages/);
  assert.match(source, /item\s*!==\s*['"]telefono['"]/);
  assert.match(source, /shouldAttemptInstagramAutoSale/);
  assert.match(source, /direction\s*===\s*['"]outbound['"]/);
});

test('un mismo DM de Instagram puede generar pedidos posteriores sin mezclar la venta anterior', () => {
  const autoSale = read('src/lib/orders/instagram-auto-sale.ts');
  const conversationSale = read('src/lib/orders/conversation-sale.ts');

  assert.match(autoSale, /onlyUnlinkedMessages/);
  assert.match(autoSale, /linkUnassignedMessages/);
  assert.match(autoSale, /cycle:/);
  assert.match(conversationSale, /allowExistingOrder/);
  assert.match(conversationSale, /onlyUnlinkedMessages/);
  assert.match(conversationSale, /\.is\(['"]order_id['"],\s*null\)/);
  assert.match(conversationSale, /linkUnassignedMessages/);
  assert.match(conversationSale, /from\(['"]omnichannel_messages['"]\)[\s\S]*order_id:\s*order\.numeric_id/);
});

test('pedido de Instagram completa el mismo cliente CRM con teléfono y dirección y conserva datos operativos', () => {
  const conversationSale = read('src/lib/orders/conversation-sale.ts');
  const customers = read('src/lib/repositories/customers-repository.ts');

  assert.match(customers, /preferredCustomerId/);
  assert.match(conversationSale, /conversation\.customer_id\s*\|\|\s*conversation\.contact_id/);
  assert.match(conversationSale, /phone:\s*draft\.phone/);
  assert.match(conversationSale, /direccion:\s*draft\.address/);
  assert.match(conversationSale, /source_channel:\s*conversation\.channel/);
  assert.match(conversationSale, /fecha_entrega:\s*draft\.deliveryDate/);
  assert.match(conversationSale, /comuna:\s*draft\.comuna/);
});

test('confirmación humana de pago posterior actualiza el pedido existente y no crea otro', () => {
  const autoSale = read('src/lib/orders/instagram-auto-sale.ts');

  assert.match(autoSale, /reconcileExistingInstagramOrderPayment/);
  assert.match(autoSale, /payment_status/);
  assert.match(autoSale, /status:\s*['"]confirmed['"]/);
  assert.match(autoSale, /linkMessagesToOrder/);
  assert.match(autoSale, /conversation\.order_id/);
  assert.match(autoSale, /hasCustomerNewOrderSignal/);
});

test('backfill de Instagram consulta conversaciones desde Page ID y reutiliza persistencia canónica', () => {
  const relativePath = 'src/lib/meta/instagram-backfill.ts';
  assert.equal(existsSync(join(root, relativePath)), true, 'debe existir sincronizador histórico de Instagram');
  const source = read(relativePath);
  assert.match(source, /PAGE_ID|pageId/);
  assert.match(source, /platform=instagram/);
  assert.match(source, /persistMessage/);
  assert.match(source, /autoRegisterInstagramConversationSale/);
  assert.doesNotMatch(source, /instagramBusinessId\}\/conversations/);
});

test('webhook puede validar una rotación controlada de secretos sin desactivar HMAC', () => {
  const route = read('src/app/api/instagram/route.ts');
  const signature = read('src/lib/messaging/signature.ts');
  assert.match(signature, /verifyHmacAny/);
  assert.match(route, /META_BRIDGE_APP_SECRET/);
  assert.match(route, /verifyHmacAny/);
  assert.doesNotMatch(route, /invalid_signature[^\n]*200/);
});
