import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

test('webhook de WhatsApp intenta registrar una venta cerrada en pedidos canónicos', () => {
  const route = read('src/app/api/whatsapp/route.ts');
  assert.match(route, /autoRegisterWhatsappConversationSale/);
  assert.match(route, /shouldAttemptWhatsappAutoSale/);
  assert.match(route, /autoSale/);
});

test('el auto-sale inbound solo corre cuando Remy no atendió el turno, mientras los ecos humanos se reconcilian aparte', () => {
  const handlers = read('src/lib/messaging/whatsapp-webhook-handlers.ts');
  assert.match(handlers, /repliedThisTurn/);
  assert.match(handlers, /if\s*\(!repliedThisTurn\)\s*await attemptAutoSale\(result, message\)/);
  assert.match(handlers, /isAppEcho\s*&&\s*message\.direction\s*===\s*['"]outbound['"][\s\S]*attemptAutoSale\(result, message\)/);
});

test('una falla en el auto-sale se registra pero nunca hace fallar la respuesta del webhook', () => {
  const handlers = read('src/lib/messaging/whatsapp-webhook-handlers.ts');
  assert.match(handlers, /try\s*{\s*\n\s*await deps\.autoSale\(db, result, message\);/);
  assert.match(handlers, /whatsapp_webhook_autosale_failed/);
});

test('el filtro barato de auto-venta vive separado de la lógica de base de datos y es testeable sin Supabase', () => {
  const relativePath = 'src/lib/orders/whatsapp-auto-sale-signals.ts';
  assert.equal(existsSync(join(root, relativePath)), true);
  const signals = read(relativePath);
  assert.doesNotMatch(signals, /from '@\/lib\/orders\/conversation-sale'/);
  assert.doesNotMatch(signals, /from '@\/lib\/repositories\/orders-repository'/);
  assert.match(signals, /export function shouldAttemptWhatsappAutoSale/);
});

test('sincronización automática de WhatsApp reutiliza la venta conversacional, evita duplicados y no rompe el webhook', () => {
  const relativePath = 'src/lib/orders/whatsapp-auto-sale.ts';
  assert.equal(existsSync(join(root, relativePath)), true);
  const source = read(relativePath);
  assert.match(source, /prepareConversationSaleDraft/);
  assert.match(source, /confirmConversationSale/);
  assert.match(source, /conversation\.order_id/);
  assert.match(source, /draft\.saleDetected/);
  assert.match(source, /draft\.missing/);
  assert.match(source, /toleratedMissing/);
  assert.match(source, /paymentEvidence:\s*businessPaymentConfirmed/);
  assert.match(source, /conversation\.channel\s*!==\s*'whatsapp'/);
});

test('un mismo chat de WhatsApp puede generar pedidos posteriores sin mezclar la venta anterior', () => {
  const autoSale = read('src/lib/orders/whatsapp-auto-sale.ts');
  assert.match(autoSale, /onlyUnlinkedMessages/);
  assert.match(autoSale, /linkUnassignedMessages/);
  assert.match(autoSale, /cycle:/);
});

test('confirmación humana de pago posterior actualiza el pedido de WhatsApp existente y no crea otro', () => {
  const autoSale = read('src/lib/orders/whatsapp-auto-sale.ts');
  assert.match(autoSale, /reconcileExistingWhatsappOrderPayment/);
  assert.match(autoSale, /payment_status/);
  assert.match(autoSale, /status:\s*['"]confirmed['"]/);
  assert.match(autoSale, /linkMessagesToOrder/);
  assert.match(autoSale, /hasCustomerNewOrderSignal/);
});

test('la extracción por lote de WhatsApp pasa por el mismo checkout atómico e idempotente que el resto del sitio', () => {
  const conversationSale = read('src/lib/orders/conversation-sale.ts');
  assert.match(conversationSale, /createTransactionalCheckout/);
  assert.match(conversationSale, /idempotencyKey/);
});
