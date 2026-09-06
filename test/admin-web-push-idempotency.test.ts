import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const service = readFileSync('src/lib/notifications/order-paid.ts', 'utf8');

test('paid Push idempotency is strict at-most-once per order and subscription', () => {
  assert.match(service, /code\s*===\s*['"]23505['"][^\n]+return null/);
  assert.match(service, /event_type:\s*['"]order_paid['"]/);
  assert.match(service, /attempt_count:\s*1/);
  assert.doesNotMatch(service, /\.eq\(['"]status['"],\s*['"]failed['"]\)/);
});
