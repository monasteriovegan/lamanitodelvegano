import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { scheduledJobEnabled } from '../src/lib/runtime/production-controls.ts';

test('cutover controls pause each external producer only when explicitly disabled', () => {
  assert.equal(scheduledJobEnabled('reconcile', {}), true);
  assert.equal(scheduledJobEnabled('reconcile', { LMV_CRON_RECONCILE_ENABLED: 'false' }), false);
  assert.equal(scheduledJobEnabled('opportunities', { LMV_CRON_OPPORTUNITIES_ENABLED: 'false' }), false);
  assert.equal(scheduledJobEnabled('abandoned-carts', { LMV_CRON_ABANDONED_CARTS_ENABLED: 'false' }), false);
});

test('all production producers enforce their cutover controls', () => {
  const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
  assert.match(read('src/app/api/cron/reconcile-pending-sales/route.ts'), /scheduledJobEnabled\('reconcile'\)/);
  assert.match(read('src/app/api/cron/sales-opportunities/route.ts'), /scheduledJobEnabled\('opportunities'\)/);
  assert.match(read('src/app/api/cron/carritos-abandonados/route.ts'), /scheduledJobEnabled\('abandoned-carts'\)/);
});
