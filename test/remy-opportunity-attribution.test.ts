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

test('conversation order link attributes opportunities transactionally without changing pedidos', () => {
  const sql = fs.readFileSync('supabase/migrations/20260905090000_sales_opportunities.sql', 'utf8');
  assert.match(sql, /attribute_conversation_order_opportunity_v1/);
  assert.match(sql, /after\s+insert\s+on\s+public\.conversation_orders/i);
  assert.match(sql, /converted_order_id\s*=\s*new\.pedido_id/i);
  assert.match(sql, /converted_revenue\s*=\s*coalesce\(v_total/i);
  assert.match(sql, /recovered_sale\s*=\s*\(/i);
  assert.doesNotMatch(sql, /update\s+public\.pedidos/i);
});
