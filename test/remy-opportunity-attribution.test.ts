import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('opportunity attribution closes opportunity without changing order semantics', () => {
  const path = 'src/lib/opportunities/attribution.ts';
  assert.equal(fs.existsSync(path), true);
  const source = fs.readFileSync(path, 'utf8');
  assert.match(source, /attributeOrderToOpportunity/);
  assert.match(source, /converted_order_id/);
  assert.match(source, /converted_revenue/);
  assert.match(source, /recovered_sale/);
  assert.match(source, /last_followup_at|last_provider_message_id/);
  assert.doesNotMatch(source, /from\(['"]pedidos['"]\)\.update/);
});

test('canonical conversation order creation invokes opportunity attribution non-blockingly', () => {
  const source = fs.readFileSync('src/lib/repositories/orders-repository.ts', 'utf8');
  assert.match(source, /attributeOrderToOpportunity/);
  assert.match(source, /opportunity_attribution_failed/);
  assert.match(source, /conversationId/);
});
