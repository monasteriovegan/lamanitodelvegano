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
  assert.match(route, /payloadUsernameMap/);
});

test('Conversaciones expone un identificador legible/buscable de Instagram sin perder el thread id', () => {
  const route = read('src/app/api/admin/conversations/route.ts');
  assert.match(route, /externalId:\s*row\.channel === 'instagram'/);
  assert.match(route, /instagramUsername/);
  assert.match(route, /externalThreadId:\s*row\.external_conversation_id/);
});

test('el webhook de Instagram resuelve el perfil antes de persistir y enriquece el contacto existente', () => {
  const webhook = read('src/app/api/instagram/route.ts');
  assert.match(webhook, /enrichInstagramMessageIdentity/);
  assert.match(webhook, /persistInstagramIdentity/);
  assert.match(webhook, /resolveBusinessUnitForMessage/);
});
