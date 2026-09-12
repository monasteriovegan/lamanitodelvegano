import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260912010000_enforce_blocked_delivery_dates.sql'),
  'utf8',
);

test('pedidos has a database-level blocked delivery date guard', () => {
  assert.match(migration, /create or replace function public\.enforce_unblocked_delivery_date/i);
  assert.match(migration, /blocked_delivery_dates/i);
  assert.match(migration, /business_unit_id/i);
  assert.match(migration, /delivery_date_blocked:/i);
  assert.match(migration, /before insert or update of fecha_entrega, business_unit_id on public\.pedidos/i);
});
