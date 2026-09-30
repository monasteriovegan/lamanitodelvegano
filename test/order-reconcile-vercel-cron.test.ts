import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { hasValidCronAuthorization } from '../src/lib/security/cron-authorization.ts';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

test('Vercel has no schedules after the no-overlap cutover commit', () => {
  const config = JSON.parse(read('vercel.json')) as { crons?: Array<{ path: string; schedule: string }> };
  assert.deepEqual(config.crons || [], []);
});

test('all migrated endpoints retain GET fail-closed authorization and 60 second bounds', () => {
  assert.equal(hasValidCronAuthorization(null, 'expected'), false);
  assert.equal(hasValidCronAuthorization('Bearer wrong', 'expected'), false);
  assert.equal(hasValidCronAuthorization('Bearer expected', ''), false);
  assert.equal(hasValidCronAuthorization('Bearer expected', 'expected'), true);

  const routes = [
    'src/app/api/cron/reconcile-pending-sales/route.ts',
    'src/app/api/cron/carritos-abandonados/route.ts',
    'src/app/api/cron/sales-opportunities/route.ts',
  ];
  for (const path of routes) {
    const route = read(path);
    assert.match(route, /export async function GET\(/, `${path} must retain GET`);
    assert.match(route, /process\.env\.CRON_SECRET/, `${path} must read CRON_SECRET`);
    assert.match(route, /hasValidCronAuthorization\(authHeader, (?:secret|process\.env\.CRON_SECRET)\)/, `${path} must retain the shared guard`);
    assert.match(route, /export const maxDuration = 60/, `${path} must retain the 60 second bound`);
  }

  const reconcile = read(routes[0]);
  assert.match(reconcile, /reconcilePendingSales/);
  assert.match(reconcile, /limit:\s*10/);
  assert.match(reconcile, /hours:\s*72/);
});

test('database scheduler migration is intentionally inert to avoid duplicate schedulers', () => {
  const migration = read('supabase/migrations/20260903223000_schedule_order_reconciliation.sql');
  assert.doesNotMatch(migration, /cron\.schedule/i);
  assert.doesNotMatch(migration, /extensions\.http/i);
  assert.match(migration, /Vercel Cron/i);
});
