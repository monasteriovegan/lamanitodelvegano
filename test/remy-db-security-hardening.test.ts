import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const path = 'supabase/migrations/20260906001000_remy_trigger_security_hardening.sql';

test('Remy trigger functions use a fixed search_path and handoff is not callable as public RPC', () => {
  assert.equal(existsSync(path), true, 'security hardening migration must exist');
  const sql = readFileSync(path, 'utf8');

  assert.match(sql, /alter function public\.remy_set_cart_commerce_stage\(\) set search_path = public/i);
  assert.match(sql, /alter function public\.remy_sync_order_commerce_stage\(\) set search_path = public/i);
  assert.match(sql, /revoke execute on function public\.remy_claim_web_whatsapp_handoff\(\) from public/i);
  assert.match(sql, /revoke execute on function public\.remy_claim_web_whatsapp_handoff\(\) from anon/i);
  assert.match(sql, /revoke execute on function public\.remy_claim_web_whatsapp_handoff\(\) from authenticated/i);
});
