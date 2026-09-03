import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const source = readFileSync(join(process.cwd(), 'src/lib/meta/instagram-backfill.ts'), 'utf8');

test('backfill prioriza Instagram Login para recuperar conversaciones', () => {
  assert.match(source, /getInstagramLoginCredential/);
  assert.match(source, /graph\.instagram\.com/);
  assert.match(source, /instagram_business_manage_messages|instagram_login/i);
});

test('backfill histórico conserva el Instagram asset canónico para resolver el tenant', () => {
  assert.match(source, /business_instagram_id/);
  assert.match(source, /routingBusinessInstagramId|businessInstagramId/);
});

test('backfill conserva el username real de Instagram para identificar al cliente', () => {
  assert.match(source, /username/);
  assert.match(source, /usernames/);
});

test('backfill conserva Facebook Login como fallback si Instagram Login no está disponible', () => {
  assert.match(source, /getActiveCredential/);
  assert.match(source, /discoverConversationSource/);
  assert.match(source, /targetId:\s*['"]me['"]/);
  assert.match(source, /targetId:\s*input\.pageId/);
  assert.match(source, /targetId:\s*input\.businessInstagramId/);
  assert.match(source, /v25\.0/);
  assert.match(source, /v24\.0/);
});
