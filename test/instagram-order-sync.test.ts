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
  assert.equal(existsSync(join(root, relativePath)), true);
  const source = read(relativePath);
  assert.match(source, /prepareConversationSaleDraft/);
  assert.match(source, /confirmConversationSale/);
  assert.match(source, /conversation\.order_id/);
  assert.match(source, /draft\.saleDetected/);
  assert.match(source, /draft\.missing\.length/);
  assert.match(source, /paymentEvidence:\s*businessPaymentConfirmed/);
});

test('sincronización automática puede completar teléfono explícito del chat y exige señal comercial', () => {
  const source = read('src/lib/orders/instagram-auto-sale.ts');
  const signals = read('src/lib/orders/instagram-auto-sale-signals.ts');
  assert.match(source, /extractPhoneFromMessages/);
  assert.match(source, /item\s*!==\s*['"]telefono['"]/);
  assert.match(source, /shouldAttemptInstagramAutoSale/);
  assert.match(signals, /direction\s*===\s*['"]outbound['"]/);
  assert.match(signals, /BUSINESS_SALE_SIGNAL/);
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
});

test('pedido de Instagram completa el mismo cliente CRM con teléfono y dirección y conserva datos operativos', () => {
  const conversationSale = read('src/lib/orders/conversation-sale.ts');
  const customers = read('src/lib/repositories/customers-repository.ts');
  assert.match(customers, /preferredCustomerId/);
  assert.match(conversationSale, /conversation\.customer_id\s*\|\|\s*conversation\.contact_id/);
  assert.match(conversationSale, /phone:\s*draft\.phone/);
  assert.match(conversationSale, /direccion:\s*draft\.address/);
  assert.match(conversationSale, /source_channel:\s*conversation\.channel/);
});

test('confirmación humana de pago posterior queda marcada para revisión, nunca marca pagado sola', () => {
  const autoSale = read('src/lib/orders/instagram-auto-sale.ts');
  assert.match(autoSale, /flagPossiblePaymentForAdminReview/);
  assert.match(autoSale, /payment_status/);
  assert.doesNotMatch(autoSale, /payment_status:\s*['"]paid['"]/);
  assert.match(autoSale, /linkMessagesToOrder/);
  assert.match(autoSale, /hasCustomerNewOrderSignal/);
  assert.match(autoSale, /pago_por_verificar/);
});

test('backfill de Instagram consulta conversaciones desde Page ID y reutiliza persistencia canónica', () => {
  const source = read('src/lib/meta/instagram-backfill.ts');
  assert.match(source, /PAGE_ID|pageId/);
  assert.match(source, /platform=instagram/);
  assert.match(source, /persistMessage/);
  assert.match(source, /autoRegisterInstagramConversationSale/);
});

test('backfill usa la conexión Meta activa cifrada del tenant', () => {
  const backfill = read('src/lib/meta/instagram-backfill.ts');
  const repository = read('src/lib/repositories/meta-connections-repository.ts');
  const crypto = read('src/lib/meta/token-crypto.ts');
  assert.match(backfill, /MetaConnectionsRepository/);
  assert.match(backfill, /getActiveCredential/);
  assert.match(repository, /meta_connections/);
  assert.match(repository, /access_token_ciphertext/);
  assert.match(repository, /decryptMetaToken/);
  assert.match(crypto, /aes-256-gcm/);
  assert.doesNotMatch(backfill, /wa_access_token/);
});

test('Facebook Login de Instagram envía por Page ID y no por Instagram Business ID', () => {
  const transport = read('src/lib/messaging/transports/instagram-meta.ts');
  assert.match(transport, /pageId/);
  assert.match(transport, /pageAccessToken/);
  assert.match(transport, /encodeURIComponent\(pageId\)[\s\S]*\/messages/);
  assert.doesNotMatch(transport, /encodeURIComponent\(instagramBusinessId\)[\s\S]*\/messages/);
});

test('webhook puede validar una rotación controlada de secretos sin desactivar HMAC', () => {
  const route = read('src/app/api/instagram/route.ts');
  const signature = read('src/lib/messaging/signature.ts');
  assert.match(signature, /verifyHmacAny/);
  assert.match(route, /META_BRIDGE_APP_SECRET/);
  assert.match(route, /verifyHmacAny/);
  assert.doesNotMatch(route, /invalid_signature[^\n]*200/);
});
