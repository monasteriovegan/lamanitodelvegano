import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

test('manual order transaction is canonical, idempotent and payment-aware', () => {
  const repo = read('src/lib/repositories/orders-repository.ts');
  const migration = read('supabase/migrations/20260903220000_admin_order_transactions.sql');
  assert.match(repo, /export type ManualOrderInput/);
  assert.match(repo, /createManualOrder/);
  assert.match(repo, /admin_create_order_v1/);
  assert.match(repo, /sourceChannel/);
  assert.match(repo, /paymentStatus/);
  assert.match(migration, /create or replace function public\.admin_create_order_v1/i);
  assert.match(migration, /idempotency/i);
  assert.match(migration, /descontar_stock_v2/i);
  assert.match(migration, /source_channel/i);
  assert.match(migration, /payment_status/i);
});

test('unidentified payments have a dedicated reconciliation queue', () => {
  const migration = read('supabase/migrations/20260903220000_admin_order_transactions.sql');
  assert.match(migration, /payment_reconciliation_queue/i);
  assert.match(migration, /unmatched/i);
  assert.match(migration, /linked_order_id/i);
  assert.match(migration, /linked_conversation_id/i);
});