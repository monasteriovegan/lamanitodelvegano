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

test('Clientes CRM muestra el @usuario de Instagram como dato de contacto primordial', () => {
  const page = read('src/app/admin/clientes/page.tsx');
  assert.match(page, /Instagram/);
  assert.match(page, /instagramUsername/);
  assert.match(page, /Buscar por nombre, @Instagram, email, teléfono/);
});
