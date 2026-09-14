import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

test('orders list exposes manual creation and channel remains prominent', () => {
  const page = read('src/app/admin/pedidos/page.tsx');
  assert.match(page, /\+ Nuevo pedido/);
  assert.match(page, /\/admin\/pedidos\/nuevo/);
  assert.match(page, />Canal</);
});

test('orders list keeps management entry points visible on desktop', () => {
  const page = read('src/app/admin/pedidos/page.tsx');
  assert.match(page, /<Link href=\{`\/admin\/pedidos\/\$\{o\.id\}`\} className="[^"]*font-mono[^"]*">/);
  const stickyActionCells = page.match(/sticky right-0/g)?.length ?? 0;
  assert.ok(stickyActionCells >= 2, 'desktop action header and cells must remain sticky on the right');
  assert.match(page, /Gestionar →/);
});

test('order detail exposes full edit workflow', () => {
  const detail = read('src/app/admin/pedidos/[id]/page.tsx');
  const form = read('src/app/admin/pedidos/[id]/OrderEditForm.tsx');
  const actions = read('src/app/admin/pedidos/actions.ts');
  assert.match(detail, /OrderEditForm/);
  assert.match(form, /Editar pedido/);
  assert.match(form, /paymentStatus/);
  assert.match(form, /shippingCost/);
  assert.match(form, /sourceChannel/);
  assert.match(form, /Producto personalizado/);
  assert.match(actions, /guardarPedidoCompleto/);
});

test('manual order page uses canonical server action and supports custom items', () => {
  const page = read('src/app/admin/pedidos/nuevo/page.tsx');
  const form = read('src/app/admin/pedidos/nuevo/ManualOrderForm.tsx');
  const actions = read('src/app/admin/pedidos/actions.ts');
  assert.match(page, /ManualOrderForm/);
  assert.match(form, /crearPedidoManual/);
  assert.match(form, /Producto personalizado/);
  assert.match(form, /paymentStatus/);
  assert.match(form, /sourceChannel/);
  assert.match(actions, /crearPedidoManual/);
});