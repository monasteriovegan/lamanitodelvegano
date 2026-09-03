import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

test('el endpoint global de Remy Instagram exige sesión autorizada y valida origen', () => {
  const route = read('src/app/api/admin/conversations/remy-instagram/route.ts');
  assert.match(route, /getCurrentAdminUser/);
  assert.match(route, /No autorizado/);
  assert.match(route, /invalid_origin/);
});

test('el endpoint cambia solo metadata.channels.instagram conservando el resto del runtime', () => {
  const route = read('src/app/api/admin/conversations/remy-instagram/route.ts');
  assert.match(route, /agent_runtime_configs/);
  assert.match(route, /channels/);
  assert.match(route, /instagram:\s*enabled/);
  assert.match(route, /currentMetadata/);
});

test('Conversaciones muestra un interruptor global visible y usa la misma fuente de verdad', () => {
  const client = read('src/app/admin/conversaciones/ConversationsClient.tsx');
  assert.match(client, /Remy Instagram/);
  assert.match(client, /\/api\/admin\/conversations\/remy-instagram/);
  assert.match(client, /instagramRemyEnabled/);
  assert.match(client, /Los DM siguen entrando al CRM/);
});
