import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

test('Clientes CRM busca por @usuario de Instagram', () => {
  const page = read('src/app/admin/clientes/page.tsx');
  assert.match(page, /instagramUsername/);
  assert.match(page, /usernameMatch/);
  assert.match(page, /instagram_username/);
});

test('Clientes CRM muestra @usuario de Instagram en el listado y en la ficha', () => {
  const listPage = read('src/app/admin/clientes/page.tsx');
  const detailPage = read('src/app/admin/clientes/[id]/page.tsx');
  assert.match(listPage, /Instagram/);
  assert.match(listPage, /instagramUsername/);
  assert.match(detailPage, /instagramUsername/);
  assert.match(detailPage, /Instagram/);
});
