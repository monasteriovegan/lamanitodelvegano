import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const source = readFileSync(join(process.cwd(), 'src/lib/meta/instagram-backfill.ts'), 'utf8');

test('backfill puede cambiar de endpoint si Page conversations devuelve Timeout', () => {
  assert.match(source, /discoverConversationSource/);
  assert.match(source, /businessInstagramId/);
  assert.match(source, /targetId:\s*['"]me['"]/);
  assert.match(source, /targetId:\s*input\.pageId/);
  assert.match(source, /targetId:\s*input\.businessInstagramId/);
});

test('backfill conserva fallback de versión Graph sin usar un token distinto', () => {
  assert.match(source, /v25\.0/);
  assert.match(source, /v24\.0/);
  assert.doesNotMatch(source, /graph\.instagram\.com/);
});
