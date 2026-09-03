import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

test('batch reconciler retries pending Instagram and WhatsApp sales idempotently', () => {
  const source = read('src/lib/orders/reconcile-pending-sales.ts');
  assert.match(source, /autoRegisterInstagramConversationSale/);
  assert.match(source, /autoRegisterWhatsappConversationSale/);
  assert.match(source, /conversation_reconciliation_state/);
  assert.match(source, /instagram/);
  assert.match(source, /whatsapp/);
  assert.match(source, /order_id/);
  assert.match(source, /personal/);
  assert.match(source, /limit/);
});

test('protected batch reconciliation route delegates to the shared reconciler', () => {
  const route = read('src/app/api/internal/reconcile-pending-sales/route.ts');
  assert.match(route, /reconcilePendingSales/);
  assert.match(route, /x-order-reconcile-key/);
  assert.match(route, /wa_verify_token/);
  assert.match(route, /sha256/);
});

test('reconciliation state migration tracks retry outcome and missing fields', () => {
  const migration = read('supabase/migrations/20260903215000_order_reconciliation_state.sql');
  assert.match(migration, /conversation_reconciliation_state/i);
  assert.match(migration, /last_attempt_at/i);
  assert.match(migration, /last_status/i);
  assert.match(migration, /missing\s+jsonb/i);
  assert.match(migration, /attempts\s+integer/i);
  assert.match(migration, /last_error/i);
});