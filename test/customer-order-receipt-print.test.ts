import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

const receiptPath = 'src/app/admin/pedidos/[id]/ClientReceiptPrintButton.tsx';

test('customer receipt is a dedicated A4 print without internal production data', () => {
  assert.ok(existsSync(join(root, receiptPath)), 'missing dedicated customer receipt print component');
  const receipt = read(receiptPath);

  assert.match(receipt, /COMPROBANTE DE PEDIDO/);
  assert.match(receipt, /DATOS DE ENTREGA/);
  assert.match(receipt, /DETALLE DEL PEDIDO/);
  assert.match(receipt, /NOTA DE TU PEDIDO/);
  assert.match(receipt, /@page\s*\{\s*size:\s*A4/i);
  assert.match(receipt, /class=\"receipt-item\"/);
  assert.match(receipt, /page-break-inside:\s*avoid/);
  assert.match(receipt, /escapeHtml/);
  assert.match(receipt, /PRECIO POR REVISAR/i);
  assert.doesNotMatch(receipt, /order\.admin_notes/);
  assert.doesNotMatch(receipt, /RECORTAR AQUÍ/i);
  assert.doesNotMatch(receipt, /USO INTERNO/i);
});

test('admin order detail clearly separates production and customer receipt actions', () => {
  const page = read('src/app/admin/pedidos/[id]/page.tsx');
  const kitchen = read('src/app/admin/pedidos/[id]/KitchenPrintButton.tsx');
  const receipt = existsSync(join(root, receiptPath)) ? read(receiptPath) : '';

  assert.match(page, /ClientReceiptPrintButton/);
  assert.match(page, /<KitchenPrintButton order=\{order\} \/>/);
  assert.match(page, /<ClientReceiptPrintButton order=\{order\} \/>/);
  assert.match(kitchen, /🖨️ Orden de producción/);
  assert.match(receipt, /🧾 Comprobante \/ detalle del pedido/);
});

test('legacy ambiguous print button is hidden once dedicated print actions exist', () => {
  const page = read('src/app/admin/pedidos/[id]/page.tsx');

  assert.match(page, /order-actions-with-dedicated-print/);
  assert.match(page, /button\.flex-1\s*\{\s*display:\s*none\s*!important/);
  assert.match(page, /button\[title\^="Restablecer estado"\]/);
  assert.match(page, /Historial de impresiones/);
});
