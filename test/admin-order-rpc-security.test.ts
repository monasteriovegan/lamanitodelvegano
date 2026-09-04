import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const migrationPath = new URL('../supabase/migrations/20260904203000_lock_admin_order_rpcs.sql', import.meta.url);

test('admin order RPCs are callable only by service_role', () => {
  const sql = readFileSync(migrationPath, 'utf8');

  for (const fn of ['admin_create_order_v1', 'admin_update_order_v1']) {
    assert.match(sql, new RegExp(`revoke all on function public\\.${fn}\\(`, 'i'));
    assert.match(sql, new RegExp(`grant execute on function public\\.${fn}\\(`, 'i'));
  }

  assert.match(sql, /from public, anon, authenticated/i);
  assert.match(sql, /to service_role/i);
});
