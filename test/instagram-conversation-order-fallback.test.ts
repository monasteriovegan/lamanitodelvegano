import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';

const sale = readFileSync(new URL('../src/lib/orders/conversation-sale.ts', import.meta.url), 'utf8');
const autoSale = readFileSync(new URL('../src/lib/orders/instagram-auto-sale.ts', import.meta.url), 'utf8');
const orders = readFileSync(new URL('../src/lib/repositories/orders-repository.ts', import.meta.url), 'utf8');

test('conversation sale validates catalog items even when no configured shipping zone matches', () => {
  assert.match(sale, /catalogItems\.length/);
  assert.match(sale, /calcularPedido/);
  assert.match(sale, /zonaId: zone\?\.id \|\| null/);
  assert.match(sale, /customUnitPrice/);
});

test('Instagram auto-sale can preserve an explicit transcript total as custom shipping', () => {
  assert.match(autoSale, /allowMissingPhone:\s*true/);
  assert.match(autoSale, /allowTranscriptShipping:\s*true/);
  assert.match(autoSale, /transcriptTotal[^\n]*>=?[^\n]*calculated\.subtotal/);
  assert.match(autoSale, /zona_despacho/);
  assert.match(autoSale, /total_no_coincide/);
});

test('conversation confirmation uses a dedicated conversation-order transaction', () => {
  assert.match(sale, /createConversationOrder\(/);
  assert.match(orders, /createConversationOrder\(/);
  assert.match(orders, /conversation_create_order_v1/);
});

test('database guard always mirrors conversations.order_id into conversation_orders', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20260904004500_conversation_order_link_guard.sql', import.meta.url), 'utf8');
  assert.match(sql, /conversation_orders/i);
  assert.match(sql, /new\.order_id/i);
  assert.match(sql, /on conflict \(conversation_id, pedido_id\) do nothing/i);
  assert.match(sql, /after insert or update of order_id/i);
  assert.match(sql, /where c\.order_id is not null/i);
});

test('conversation order RPC keeps phone and shipping zone optional without weakening web checkout', () => {
  const migrationDir = new URL('../supabase/migrations/', import.meta.url);
  const filename = readdirSync(migrationDir).find((name) => name.includes('conversation_order'));
  assert.ok(filename, 'conversation order migration is missing');
  const sql = readFileSync(new URL(filename!, migrationDir), 'utf8');

  assert.match(sql, /create or replace function public\.conversation_create_order_v1/i);
  assert.match(sql, /p_customer_phone text/i);
  assert.match(sql, /p_shipping_zone_id uuid/i);
  assert.match(sql, /p_source_channel text/i);
  assert.match(sql, /conversation_id/i);
  assert.match(sql, /if nullif\(btrim\(p_customer_phone\), ''\) is not null then/i);
  assert.doesNotMatch(sql, /p_customer_phone is null[^;]+missing_customer_data/i);
  assert.match(sql, /revoke all on function public\.conversation_create_order_v1[\s\S]*from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.conversation_create_order_v1[\s\S]*to service_role/i);
});
