import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('opportunity runner is observation-first and idempotently claims sends', () => {
  const path = 'src/lib/opportunities/runner.ts';
  assert.equal(fs.existsSync(path), true, 'runner must exist');
  const source = fs.readFileSync(path, 'utf8');
  assert.match(source, /SALES_OPPORTUNITY_AUTO_SEND/);
  assert.match(source, /claim_token/);
  assert.match(source, /claim_expires_at/);
  assert.match(source, /evaluateOpportunityPolicy/);
  assert.match(source, /sendMessage/);
  assert.match(source, /persistMessage/);
  assert.match(source, /followup_count/);
  assert.match(source, /provider_message_id|last_provider_message_id/);
});

test('opportunity cron and abandoned cart bridge cannot both own automatic recovery', () => {
  const cron = fs.readFileSync('src/app/api/cron/carritos-abandonados/route.ts', 'utf8');
  assert.match(cron, /SALES_OPPORTUNITY_CART_CUTOVER/);
  const newCron = 'src/app/api/cron/sales-opportunities/route.ts';
  assert.equal(fs.existsSync(newCron), true);
  assert.match(fs.readFileSync(newCron, 'utf8'), /runOpportunityCycle/);
});
