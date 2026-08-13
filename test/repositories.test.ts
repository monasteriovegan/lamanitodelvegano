import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? sourceFiles(path) : /\.(ts|tsx)$/.test(path) ? [path] : [];
  });
}

const forbiddenRuntimeTables = [
  'orders',
  'customers',
  'businesses',
  'crm_conversations',
  'crm_messages',
  'site_settings',
  'crm_ai_settings',
];

test('OrderRepository usa pedidos integer y no crea una orden paralela', () => {
  const source = read('src/lib/repositories/orders-repository.ts');
  assert.match(source, /\.from\('pedidos'\)/);
  assert.match(source, /Number\.isInteger/);
  assert.match(source, /pedido_id:\s*pedidoId/);
  assert.doesNotMatch(source, /\.from\(['"]orders['"]\)/);
});

test('CustomerRepository usa omnichannel_contacts y asociaciones reconciliadas', () => {
  const source = read('src/lib/repositories/customers-repository.ts');
  assert.match(source, /\.from\('omnichannel_contacts'\)/);
  assert.match(source, /\.from\('customer_notes'\)/);
  assert.match(source, /\.from\('customer_tags'\)/);
  assert.match(source, /\.from\('crm_activities'\)/);
  assert.doesNotMatch(source, /\.from\(['"]customers['"]\)/);
});

test('BusinessRepository centraliza la unidad La Manito', () => {
  const source = read('src/lib/repositories/business-repository.ts');
  assert.match(source, /DEFAULT_BUSINESS_SLUG\s*=\s*'la-manito-del-vegano'/);
  assert.match(source, /\.from\('business_units'\)/);
  assert.doesNotMatch(source, /\.from\(['"]businesses['"]\)/);
});

test('ConversationRepository usa conversations y conserva contrato de Messaging Core', () => {
  const source = read('src/lib/repositories/conversations-repository.ts');
  assert.match(source, /\.from\('conversations'\)/);
  for (const field of ['customer_id', 'channel', 'status', 'mode', 'last_message', 'last_message_at', 'assigned_to', 'order_id', 'metadata']) {
    assert.match(source, new RegExp(`\\b${field}\\b`));
  }
  assert.doesNotMatch(source, /\.from\(['"]crm_conversations['"]\)/);
});

test('MessageRepository usa omnichannel_messages e idempotencia por proveedor', () => {
  const source = read('src/lib/repositories/messages-repository.ts');
  assert.match(source, /\.from\('omnichannel_messages'\)/);
  for (const field of ['provider', 'transport', 'provider_message_id', 'direction', 'status', 'body', 'sent_at', 'delivered_at', 'read_at', 'conversation_id']) {
    assert.match(source, new RegExp(`\\b${field}\\b`));
  }
  assert.doesNotMatch(source, /\.from\(['"]crm_messages['"]\)/);
});

test('productos UUID y pedidos integer permanecen en la migración reconciliada', () => {
  const source = read('supabase/migracion-omnichannel-reconciled-v2.sql');
  assert.match(source, /\('productos','id','uuid'\)/);
  assert.match(source, /\('pedidos','id','int4'\)/);
  assert.match(source, /product_id uuid not null/);
  assert.match(source, /pedido_id integer not null/);
});

test('stock v2 usa UUID, bloqueo de fila y ejecución exclusiva de service_role', () => {
  const source = read('supabase/migracion-omnichannel-reconciled-v2.sql');
  assert.match(source, /descontar_stock_v2\(\s*p_producto_id uuid,\s*p_cantidad integer/);
  assert.match(source, /from public\.productos p[\s\S]*for update/);
  assert.match(source, /insufficient_stock/);
  assert.match(source, /revoke all on function public\.descontar_stock_v2\(uuid, integer\) from public, anon, authenticated/);
  assert.match(source, /grant execute on function public\.descontar_stock_v2\(uuid, integer\) to service_role/);
});

test('checkout v2 concentra pedido, stock, carrito, atribución y conversión en un RPC', () => {
  const migration = read('supabase/migracion-omnichannel-reconciled-v2.sql');
  const repository = read('src/lib/repositories/orders-repository.ts');
  const route = read('src/app/api/checkout/route.ts');
  for (const fragment of ['checkout_create_order_v2', 'public.carts', 'public.cart_items', 'public.cart_attribution', 'public.pedidos', 'public.conversion_events', 'descontar_stock_v2']) {
    assert.match(migration, new RegExp(fragment.replace('.', '\\.')));
  }
  assert.match(repository, /\.rpc\('checkout_create_order_v2'/);
  assert.match(route, /createTransactionalCheckout/);
  assert.doesNotMatch(route, /rpc\('descontar_stock'/);
  assert.doesNotMatch(route, /createCheckoutOrder/);
});

test('checkout v2 es idempotente antes de crear pedido o descontar stock', () => {
  const migration = read('supabase/patch-checkout-idempotency.sql');
  const repository = read('src/lib/repositories/orders-repository.ts');
  const route = read('src/app/api/checkout/route.ts');
  assert.match(migration, /p_idempotency_key text/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /checkout_token_hash = token_hash/);
  assert.match(migration, /idempotent_replay/);
  assert.ok(
    migration.indexOf("if found then") < migration.indexOf("insert into public.carts"),
    'el replay debe resolverse antes de crear carrito, pedido o descontar stock',
  );
  assert.match(repository, /p_idempotency_key: input\.idempotencyKey/);
  assert.match(route, /Idempotency-Key/);
});

test('customer identities se persisten con upsert idempotente', () => {
  const source = read('src/lib/repositories/customers-repository.ts');
  assert.match(source, /private async upsertIdentities/);
  assert.match(source, /\.from\('customer_identities'\)/);
  assert.match(source, /onConflict:\s*'business_unit_id,provider,external_id'/);
  assert.match(source, /identity_type:\s*'platform_user_id'/);
  assert.match(source, /identity_type:\s*'phone'/);
  assert.match(source, /identity_type:\s*'email'/);
});

test('RLS conserva lectura pública solo de productos activos y escritura admin', () => {
  const source = read('supabase/migracion-omnichannel-reconciled-v2.sql');
  assert.match(source, /reconciled_public_select_active_productos[\s\S]*for select to anon, authenticated[\s\S]*using \(activo is true\)/);
  assert.match(source, /alter policy leer_productos[\s\S]*to authenticated[\s\S]*is_admin/);
  assert.match(source, /reconciled_admin_select_productos[\s\S]*to authenticated[\s\S]*is_admin/);
  assert.match(source, /revoke insert, update, delete, truncate on table public\.productos from anon, authenticated/);
  assert.match(source, /grant insert, update, delete on table public\.productos to authenticated/);
  assert.match(source, /alter policy insertar_productos[\s\S]*to authenticated[\s\S]*is_admin/);
});

test('migración v2 incluye índices para todas las FK críticas faltantes', () => {
  const source = read('supabase/migracion-omnichannel-reconciled-v2.sql');
  for (const index of [
    'cart_items_product_id_idx',
    'cart_attribution_customer_id_idx',
    'conversation_orders_pedido_id_idx',
    'conversion_events_customer_id_idx',
    'conversion_events_conversation_id_idx',
    'conversion_events_cart_id_idx',
  ]) assert.match(source, new RegExp(`create index if not exists ${index}`));
});

test('capabilities no habilita checkout salvo schema v2 verificado', () => {
  const source = read('src/lib/repositories/schema-capabilities.ts');
  assert.match(source, /omnichannel-reconciled-v2/);
  assert.match(source, /checkoutWrites:\s*reconciled\s*&&\s*source\.SUPABASE_CHECKOUT_SCHEMA_READY === 'true'/);
});

test('runtime src no consulta directamente tablas no canónicas', () => {
  const source = sourceFiles(join(root, 'src')).map((path) => readFileSync(path, 'utf8')).join('\n');
  for (const table of forbiddenRuntimeTables) {
    assert.doesNotMatch(source, new RegExp(`\\.from\\(\\s*['"]${table}['"]\\s*\\)`), table);
  }
});

test('configuración de IA tiene default seguro OFF', () => {
  const source = read('src/lib/repositories/settings-repository.ts');
  assert.match(source, /global_ai_enabled:\s*false/);
  assert.match(source, /automatic_ai_enabled:\s*false/);
  assert.doesNotMatch(source, /automatic_ai_enabled:\s*true/);
});

test('checkout pre-migración se bloquea antes de escribir', () => {
  const capabilities = read('src/lib/repositories/schema-capabilities.ts');
  const checkout = read('src/app/api/checkout/route.ts');
  assert.match(capabilities, /checkoutWrites:\s*reconciled\s*&&/);
  assert.match(checkout, /if \(!capabilities\.checkoutWrites\)/);
  assert.match(checkout, /SCHEMA_MIGRATION_REQUIRED/);
  assert.ok(
    checkout.indexOf('if (!capabilities.checkoutWrites)') < checkout.indexOf('await calcularPedido'),
    'el bloqueo debe ocurrir antes de cálculos o escrituras',
  );
});
