import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const migrationDirectory = new URL('../supabase/migrations/', import.meta.url);

function hotfixMigration() {
  const file = readdirSync(migrationDirectory).find((name) => name.endsWith('_p0_security_hotfix.sql'));
  assert.ok(file, 'versioned P0 security migration must exist');
  return readFileSync(new URL(file, migrationDirectory), 'utf8');
}

test('P0 migration removes public execution from every live SECURITY DEFINER function', () => {
  const sql = hotfixMigration();
  const functions = [
    'admin_conversation_inbox_summary_v1',
    'admin_create_order_v1',
    'admin_delete_order_v1',
    'admin_update_order_v1',
    'attribute_conversation_order_opportunity_v1',
    'checkout_create_order_v2',
    'checkout_schema_ready_v2',
    'consume_meta_oauth_state',
    'conversation_create_order_v1',
    'descontar_stock',
    'descontar_stock_v2',
    'enforce_unblocked_delivery_date',
    'guard_paid_purchase_conversion_v2',
    'increment_conversation_unread_v1',
    'is_admin',
    'mark_conversation_read',
    'remy_cart_mark_interested',
    'remy_cart_sync_recovery_contact',
    'remy_claim_web_whatsapp_handoff',
    'remy_order_payment_handoff',
    'set_remy_global_enabled',
    'sync_conversation_order_link_v1',
  ];

  for (const functionName of functions) {
    assert.match(
      sql,
      new RegExp(`revoke\\s+(?:all|execute)[\\s\\S]*?public\\.${functionName}`, 'i'),
      `${functionName} must be explicitly revoked`,
    );
  }
  assert.match(sql, /grant\s+execute\s+on\s+function\s+public\.is_admin\(\)\s+to\s+authenticated/i);
  const executeGrants = sql.split(';').filter((statement) => /grant\s+execute/i.test(statement));
  assert.equal(executeGrants.some((statement) => /\bto\s+anon\b/i.test(statement)), false);
});

test('P0 migration adds a private distributed limiter and P2 legacy-table hardening', () => {
  const sql = hotfixMigration();

  assert.match(sql, /create table[^;]+public\.public_tracking_rate_limits/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /consume_public_tracking_rate_limit_v1/i);
  assert.match(sql, /revoke all on table public\._catalog_asset_staging_20260910 from anon, authenticated/i);
  assert.match(sql, /revoke all on table public\.zonas_envio from anon, authenticated/i);
  assert.match(sql, /grant select on table public\.zonas_envio to anon, authenticated/i);
});
