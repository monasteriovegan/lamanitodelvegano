import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

test('CRM customer exposes Instagram username and name from contact metadata', () => {
  const source = read('src/lib/repositories/customers-repository.ts');
  assert.match(source, /instagram_username/);
  assert.match(source, /instagram_name/);
});

test('CRM repository projects conversation labels onto customers instead of duplicating operational state', () => {
  const source = read('src/lib/repositories/customers-repository.ts');
  assert.match(source, /from\(['"]conversations['"]\)[\s\S]*labels/);
  assert.match(source, /conversation_labels/);
});

test('conversation admin API accepts operational labels and returns them', () => {
  const detailRoute = read('src/app/api/admin/conversations/[id]/route.ts');
  const listRoute = read('src/app/api/admin/conversations/route.ts');
  assert.match(detailRoute, /labels\?:\s*string\[\]/);
  assert.match(detailRoute, /normalizeConversationLabels/);
  assert.match(listRoute, /labels:\s*Array\.isArray\(row\.labels\)/);
});

test('Instagram webhook enriches inbound identities with profile username/name', () => {
  const route = read('src/app/api/instagram/route.ts');
  assert.match(route, /enrichInstagramMessageProfile/);
  assert.match(route, /instagram_username/);
});

test('existing internal Instagram backfill supports a since cutoff of 2026-08-31', () => {
  const route = read('src/app/api/internal/instagram-backfill/route.ts');
  const backfill = read('src/lib/meta/instagram-backfill.ts');
  assert.match(route, /2026-08-31/);
  assert.match(route, /since/);
  assert.match(backfill, /since\?:\s*string/);
  assert.match(backfill, /updated_time/);
});

test('conversation UI shows operational labels and restores background polling', () => {
  const source = read('src/app/admin/conversaciones/ConversationsClientV2.tsx');
  assert.match(source, /labels:\s*string\[\]/);
  assert.match(source, /pagado/);
  assert.match(source, /seguimiento/);
  assert.match(source, /loadMessages\(selectedId,\s*true\)/);
});
