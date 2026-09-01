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
