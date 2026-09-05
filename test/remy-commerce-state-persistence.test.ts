import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const sql = readFileSync('supabase/migrations/20260905234500_remy_commerce_state.sql', 'utf8');

test('Remy commerce stage is persisted from cart facts and never delegated to the model', () => {
  assert.match(sql, /commerce_stage/i);
  assert.match(sql, /carritos_abandonados/i);
  assert.match(sql, /jsonb_array_length/i);
  assert.match(sql, /deliveryDate/i);
  assert.match(sql, /paymentMethod/i);
});

test('order and payment facts advance the persisted commerce stage', () => {
  assert.match(sql, /order_id/i);
  assert.match(sql, /external_token/i);
  assert.match(sql, /payment_status/i);
  assert.match(sql, /post_sale/i);
  assert.match(sql, /payment/i);
});
