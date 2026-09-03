import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const repository = readFileSync(new URL('../src/lib/repositories/customers-repository.ts', import.meta.url), 'utf8');
const page = readFileSync(new URL('../src/app/admin/clientes/page.tsx', import.meta.url), 'utf8');

test('default CRM customer list excludes contacts explicitly marked personal', () => {
  assert.match(repository, /metadata\?\.personal/);
  assert.match(repository, /filter\([\s\S]*personal/);
});

test('CRM header distinguishes all CRM contacts from contacts that already have orders', () => {
  assert.match(page, /contactos CRM/);
  assert.match(page, /clientes con pedidos/);
  assert.match(page, /total_orders/);
  assert.doesNotMatch(page, /clientes registrados/);
});
