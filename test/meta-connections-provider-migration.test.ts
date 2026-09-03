import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const migrationsDir = join(process.cwd(), 'supabase', 'migrations');

function matchingMigration() {
  const file = readdirSync(migrationsDir).find((name) => name.includes('meta_connections_instagram_login_provider'));
  assert.ok(file, 'missing migration for meta_instagram_login provider');
  return readFileSync(join(migrationsDir, file), 'utf8');
}

test('meta_connections accepts the Instagram Login credential provider', () => {
  const sql = matchingMigration();
  assert.match(sql, /drop constraint if exists meta_connections_provider_check/i);
  assert.match(sql, /provider\s+in\s*\(\s*'meta'\s*,\s*'meta_instagram_login'\s*\)/i);
});
