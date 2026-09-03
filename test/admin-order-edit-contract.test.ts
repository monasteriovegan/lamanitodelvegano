import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

test('full order edit is transactional, audited and stock-delta aware', () => {
  const service = read('src/lib/orders/admin-order-admin.ts');
  const migration = read('supabase/migrations/20260903220000_admin_order_transactions.sql');
  assert.match(service, /FullOrderUpdateInput/);
  assert.match(service, /updateFullOrder/);
  assert.match(service, /admin_update_order_v1/);
  assert.match(migration, /create table if not exists public\.order_change_log/i);
  assert.match(migration, /create or replace function public\.admin_update_order_v1/i);
  assert.match(migration, /before_snapshot/i);
  assert.match(migration, /after_snapshot/i);
  assert.match(migration, /delta/i);
  assert.match(migration, /descontar_stock_v2/i);
  assert.match(migration, /stock\s*=\s*coalesce\(stock/i);
});