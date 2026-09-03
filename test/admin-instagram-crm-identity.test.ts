import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

test('Conversaciones prioriza @usuario de Instagram sobre nombres placeholder Cliente <id>', () => {
  const route = read('src/app/api/admin/conversations/route.ts');
  assert.match(route, /instagramUsername/);
  assert.match(route, /isPlaceholderInstagramName/);
  assert.match(route, /external_username/);
});

test('el cliente de Conversaciones puede buscar y mostrar el @usuario de Instagram', () => {
  const client = read('src/app/admin/conversaciones/ConversationsClient.tsx');
  assert.match(client, /instagramUsername/);
  assert.match(client, /matchesUsername/);
});

test('resolveIdentity enriquece contactos existentes cuando Meta entrega un nombre o @usuario posterior', () => {
  const repo = read('src/lib/repositories/customers-repository.ts');
  assert.match(repo, /enrichExistingIdentityContact/);
  assert.match(repo, /input\.name/);
  assert.match(repo, /display_name/);
});
