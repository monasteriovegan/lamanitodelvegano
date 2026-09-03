import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

test('bulk-enable-ai exige sesión de admin antes de tocar la base de datos', () => {
  const route = read('src/app/api/admin/conversations/bulk-enable-ai/route.ts');
  assert.match(route, /getCurrentAdminUser/);
  assert.match(route, /No autorizado/);
});

test('bulk-enable-ai nunca reactiva contactos marcados como personales', () => {
  const route = read('src/app/api/admin/conversations/bulk-enable-ai/route.ts');
  assert.match(route, /personal/);
  assert.match(route, /return !personal/);
});

test('bulk-enable-ai solo toca whatsapp/instagram y solo los que están apagados', () => {
  const route = read('src/app/api/admin/conversations/bulk-enable-ai/route.ts');
  assert.match(route, /in\('channel',\s*\['whatsapp',\s*'instagram'\]\)/);
  assert.match(route, /eq\('ai_enabled',\s*false\)/);
});

test('el panel muestra un estado combinado por conversación y un botón de reactivación masiva', () => {
  const client = read('src/app/admin/conversaciones/ConversationsClientV2.tsx');
  assert.match(client, /function conversationAiState/);
  assert.match(client, /bulk-enable-ai/);
  assert.match(client, /pausadas`/);
});
