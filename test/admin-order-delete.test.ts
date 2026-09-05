import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

test('safe delete is transactional, admin-only, restores stock and rejects protected orders', () => {
  const migration = read('supabase/migrations/20260905005500_admin_order_safe_delete.sql');

  assert.match(migration, /admin_delete_order_v1/i);
  assert.match(migration, /security definer/i);
  assert.match(migration, /payment_status/i);
  assert.match(migration, /paid|partial|refunded/i);
  assert.match(migration, /despachado|completado|pagado/i);
  assert.match(migration, /set\s+stock\s*=\s*coalesce\(stock,\s*0\)\s*\+/i);
  assert.match(migration, /delete\s+from\s+public\.conversion_events/i);
  assert.match(migration, /delete\s+from\s+public\.pedidos/i);
  assert.match(migration, /revoke\s+all[\s\S]*admin_delete_order_v1/i);
  assert.match(migration, /grant\s+execute[\s\S]*service_role/i);
});

test('orders admin API exposes DELETE only to admin and delegates to the transactional RPC', () => {
  const route = read('src/app/api/admin/orders/[id]/route.ts');

  assert.match(route, /export\s+async\s+function\s+DELETE/);
  assert.match(route, /admin\.rol\s*!==\s*'admin'/);
  assert.match(route, /admin_delete_order_v1/);
  assert.match(route, /status:\s*409/);
});

test('order detail exposes destructive delete with double confirmation and returns to Pedidos', () => {
  const ui = read('src/app/admin/pedidos/[id]/DeleteOrderButton.tsx');
  const page = read('src/app/admin/pedidos/[id]/page.tsx');

  assert.match(ui, /Eliminar pedido/);
  assert.equal((ui.match(/window\.confirm/g) || []).length, 2);
  assert.match(ui, /method:\s*'DELETE'/);
  assert.match(ui, /router\.push\('\/admin\/pedidos'\)/);
  assert.match(page, /admin\.rol\s*===\s*'admin'/);
  assert.match(page, /<DeleteOrderButton/);
});
