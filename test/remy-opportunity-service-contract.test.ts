import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const migrationPath = 'supabase/migrations/20260905090000_sales_opportunities.sql';

test('sales opportunities schema has lifecycle and anti-duplicate constraints', () => {
  assert.equal(fs.existsSync(migrationPath), true, 'sales opportunities migration must exist');
  const sql = fs.readFileSync(migrationPath, 'utf8');
  for (const token of [
    'sales_opportunities',
    'conversation_id',
    'business_unit_id',
    'followup_count',
    'next_followup_at',
    'converted_order_id',
    'converted_revenue',
  ]) assert.match(sql, new RegExp(token));
  assert.match(sql, /where\s+status\s+in\s*\([^)]*open[^)]*snoozed/i);
  assert.match(sql, /followup_count\s+between\s+0\s+and\s+2/i);
  assert.match(sql, /enable\s+row\s+level\s+security/i);
});

test('opportunity service reads canonical conversation facts and upserts safely', () => {
  const path = 'src/lib/opportunities/service.ts';
  assert.equal(fs.existsSync(path), true, 'opportunity service must exist');
  const source = fs.readFileSync(path, 'utf8');
  for (const token of ['conversations', 'omnichannel_messages', 'carritos_abandonados', 'pedidos', 'sales_opportunities', 'detectOpportunity', 'buildOpportunityMessage']) {
    assert.match(source, new RegExp(token));
  }
  assert.match(source, /status[^\n]+open[^\n]+snoozed/i);
  assert.match(source, /evaluateConversationOpportunity/);
  assert.match(source, /closeConversationOpportunities/);
});

test('message persistence reevaluates opportunities without blocking webhook success', () => {
  const source = fs.readFileSync('src/lib/messaging/messages.ts', 'utf8');
  assert.match(source, /evaluateConversationOpportunity/);
  assert.match(source, /void\s+evaluateConversationOpportunity|void\s+import\(/);
  assert.match(source, /opportunity[^\n]*failed|opportunity_evaluation_failed/i);
});
