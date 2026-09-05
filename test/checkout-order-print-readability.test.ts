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

test('printed order is kitchen-first, A4-safe and visually prioritizes production details', () => {
  const actions = read('src/app/admin/pedidos/[id]/OrderActions.tsx');

  assert.match(actions, /QUÉ HAY QUE PREPARAR/);
  assert.match(actions, /NOTA DEL CLIENTE/);
  assert.match(actions, /DATOS DE ENTREGA/);
  assert.match(actions, /PAGO Y TOTALES/);
  assert.match(actions, /@page\s*\{\s*size:\s*A4/i);
  assert.match(actions, /class=\"qty-badge\"/);
  assert.match(actions, /class=\"production-detail\"/);
  assert.match(actions, /page-break-inside:\s*avoid/);
});

test('printed order keeps customer notes separate from internal admin notes', () => {
  const actions = read('src/app/admin/pedidos/[id]/OrderActions.tsx');

  assert.match(actions, /NOTA DEL CLIENTE/);
  assert.match(actions, /NOTA INTERNA/);
  assert.match(actions, /order\.notes/);
  assert.match(actions, /order\.admin_notes/);
});
