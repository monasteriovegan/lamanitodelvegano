import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

test('order reconciliation cron is configured in Vercel every five minutes', () => {
  const config = JSON.parse(read('vercel.json')) as { crons?: Array<{ path: string; schedule: string }> };
  const cron = (config.crons || []).find((entry) => entry.path === '/api/cron/reconcile-pending-sales');
  assert.ok(cron, 'missing reconcile cron');
  assert.equal(cron.schedule, '*/5 * * * *');
});

test('order reconciliation cron route requires CRON_SECRET and uses fixed bounded reconciliation', () => {
  const route = read('src/app/api/cron/reconcile-pending-sales/route.ts');
  assert.match(route, /process\.env\.CRON_SECRET/);
  assert.match(route, /Authorization|authorization/);
  assert.match(route, /Bearer/);
  assert.match(route, /reconcilePendingSales/);
  assert.match(route, /limit:\s*50/);
  assert.match(route, /hours:\s*72/);
});

test('database scheduler migration is intentionally inert to avoid duplicate schedulers', () => {
  const migration = read('supabase/migrations/20260903223000_schedule_order_reconciliation.sql');
  assert.doesNotMatch(migration, /cron\.schedule/i);
  assert.doesNotMatch(migration, /extensions\.http/i);
  assert.match(migration, /Vercel Cron/i);
});
