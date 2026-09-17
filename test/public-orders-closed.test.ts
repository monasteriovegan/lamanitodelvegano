import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

test('public checkout is closed for new orders while resume flow remains available', () => {
  const route = read('src/app/api/checkout/route.ts');
  assert.match(route, /const PUBLIC_ORDERS_CLOSED = true;/);
  assert.match(route, /if \(PUBLIC_ORDERS_CLOSED\) return \[\];/);
  assert.match(route, /if \(PUBLIC_ORDERS_CLOSED && !body\.resumePedidoId\)/);
  assert.match(route, /Pedidos cerrados/);
});

test('Fiestas Patrias campaign clearly shows that orders are closed and exposes no products', () => {
  const page = read('src/app/fiestas-patrias-2026/page.tsx');
  assert.match(page, /Pedidos cerrados/);
  assert.match(page, /Cupos completos/);
  assert.match(page, /products: \[\]/);
});
