import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

test('detalle de pedido Instagram muestra el @usuario del contacto vinculado', () => {
  const page = read('src/app/admin/pedidos/[id]/page.tsx');
  assert.match(page, /instagramUsername/);
  assert.match(page, /Usuario Instagram/);
  assert.match(page, /omnichannel_contacts/);
});

test('listado de pedidos hidrata y permite buscar por @usuario de Instagram sin N+1', () => {
  const page = read('src/app/admin/pedidos/page.tsx');
  assert.match(page, /instagramUsernameByCustomerId/);
  assert.match(page, /omnichannel_contacts/);
  assert.match(page, /instagramUsername/);
  assert.match(page, /usernameMatch/);
});
