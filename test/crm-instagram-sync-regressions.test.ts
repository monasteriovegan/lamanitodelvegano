import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync } from 'node:fs';

import { mapContactToAdminCustomer } from '../src/lib/repositories/customers-repository.ts';

const read = (path: string) => readFileSync(path, 'utf8');

test('CRM customer exposes Instagram username from contact metadata', () => {
  const customer = mapContactToAdminCustomer({
    id: 'c1',
    business_unit_id: 'b1',
    channel: 'instagram',
    external_id: '1057010436952778',
    nombre: 'Cliente 1057010436952778',
    metadata: { instagram_username: 'cliente_real', instagram_name: 'Cliente Real' },
  });

  assert.equal((customer as any).instagram_username, 'cliente_real');
  assert.equal((customer as any).instagram_name, 'Cliente Real');
});

test('CRM repository projects conversation labels onto customers instead of duplicating tag state', () => {
  const source = read('src/lib/repositories/customers-repository.ts');
  assert.match(source, /from\('conversations'\)[\s\S]*labels/);
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

test('admin Instagram backfill endpoint exists and defaults to 2026-08-31', () => {
  const path = 'src/app/api/admin/instagram/backfill/route.ts';
  assert.equal(existsSync(path), true);
  const source = read(path);
  assert.match(source, /2026-08-31/);
  assert.match(source, /backfillInstagramConversations/);
});

test('conversation UI shows channel labels and supports common operational labels', () => {
  const source = read('src/app/admin/conversaciones/ConversationsClient.tsx');
  assert.match(source, /conversation\.labels|selected\.labels/);
  assert.match(source, /pagado/);
  assert.match(source, /seguimiento/);
});
