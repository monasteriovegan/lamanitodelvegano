import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

test('checkout makes the optional customer note explicit and persists it with the order', () => {
  const checkoutPage = read('src/app/checkout/page.tsx');
  const checkoutRoute = read('src/app/api/checkout/route.ts');

  assert.match(checkoutPage, /¿Quieres agregar una nota a tu pedido\? \(opcional\)/);
  assert.match(checkoutPage, /cambios, sabores, restricciones/i);
  assert.match(checkoutPage, /notas:\s*notas\.trim\(\)\s*\|\|\s*null/);
  assert.match(checkoutRoute, /notes:\s*body\.notas\s*\|\|\s*null/);
  assert.match(checkoutRoute, /notas:\s*body\.notas\?\.trim\(\)\s*\|\|\s*null/);
});

test('order detail promotes the dedicated kitchen print action', () => {
  const detail = read('src/app/admin/pedidos/[id]/page.tsx');
  assert.match(detail, /KitchenPrintButton/);
  assert.match(detail, /order=\{order\}/);
});

test('printed order is kitchen-first, A4-safe and visually prioritizes production details', () => {
  const kitchenPrint = read('src/app/admin/pedidos/[id]/KitchenPrintButton.tsx');

  assert.match(kitchenPrint, /QUÉ HAY QUE PREPARAR/);
  assert.match(kitchenPrint, /NOTA DEL CLIENTE/);
  assert.match(kitchenPrint, /DATOS DE ENTREGA/);
  assert.match(kitchenPrint, /PAGO Y TOTALES/);
  assert.match(kitchenPrint, /@page\s*\{\s*size:\s*A4/i);
  assert.match(kitchenPrint, /class=\"qty-badge\"/);
  assert.match(kitchenPrint, /class=\"production-detail\"/);
  assert.match(kitchenPrint, /page-break-inside:\s*avoid/);
});

test('printed order keeps customer notes separate from internal admin notes', () => {
  const kitchenPrint = read('src/app/admin/pedidos/[id]/KitchenPrintButton.tsx');

  assert.match(kitchenPrint, /NOTA DEL CLIENTE/);
  assert.match(kitchenPrint, /NOTA INTERNA/);
  assert.match(kitchenPrint, /order\.notes/);
  assert.match(kitchenPrint, /order\.admin_notes/);
});
