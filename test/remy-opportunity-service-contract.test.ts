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
  ]) {
    assert.match(sql, new RegExp(token));
  }
  assert.match(sql, /where\s+status\s+in\s*\([^)]*open[^)]*snoozed/is);
  assert.match(sql, /followup_count\s+between\s+0\s+and\s+2/is);
  assert.match(sql, /enable\s+row\s+level\s+security/is);
});
