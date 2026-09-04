begin;

-- Checkout operational data already exists in the canonical pedidos table.
-- Notes were part of the application contract but never existed physically,
-- which caused a silent post-checkout update failure.
alter table public.pedidos
  add column if not exists notas text;

-- The order-creation RPC historically labelled a pending checkout as Purchase.
-- Keep historical attribution, but correct the lifecycle semantics: a Purchase
-- is only valid after the canonical order is actually paid.
update public.conversion_events ce
   set event_name = 'InitiateCheckout'
 where ce.event_name = 'Purchase'
   and ce.order_id is not null
   and exists (
     select 1
       from public.pedidos p
      where p.id = ce.order_id
        and coalesce(p.payment_status, 'pending') <> 'paid'
   );

create or replace function public.guard_paid_purchase_conversion_v2()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.event_name = 'Purchase' and new.order_id is not null then
    if not exists (
      select 1
        from public.pedidos p
       where p.id = new.order_id
         and p.payment_status = 'paid'
    ) then
      new.event_name := 'InitiateCheckout';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.guard_paid_purchase_conversion_v2() from public, anon, authenticated;
grant execute on function public.guard_paid_purchase_conversion_v2() to service_role;

drop trigger if exists trg_guard_paid_purchase_conversion_v2 on public.conversion_events;
create trigger trg_guard_paid_purchase_conversion_v2
before insert or update of event_name, order_id
on public.conversion_events
for each row execute function public.guard_paid_purchase_conversion_v2();

-- Runtime attestation: the checkout no longer trusts a stale Vercel flag.  It
-- asks the live production database whether the exact reconciled primitives
-- required by the write path are present.  It is service-role only.
create or replace function public.checkout_schema_ready_v2()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  has_checkout_rpc boolean;
  has_stock_rpc boolean;
  has_idempotency_unique boolean;
begin
  if to_regclass('public.pedidos') is null
     or to_regclass('public.productos') is null
     or to_regclass('public.omnichannel_contacts') is null
     or to_regclass('public.carts') is null
     or to_regclass('public.cart_items') is null
     or to_regclass('public.cart_attribution') is null
     or to_regclass('public.conversion_events') is null
     or to_regclass('public.order_status_history') is null then
    return false;
  end if;

  if not exists (
    select 1 from pg_catalog.pg_attribute a
    join pg_catalog.pg_class c on c.oid = a.attrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'pedidos'
      and a.attname = 'id' and a.atttypid = 'pg_catalog.int4'::regtype and not a.attisdropped
  ) then return false; end if;

  if not exists (
    select 1 from pg_catalog.pg_attribute a
    join pg_catalog.pg_class c on c.oid = a.attrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'productos'
      and a.attname = 'id' and a.atttypid = 'pg_catalog.uuid'::regtype and not a.attisdropped
  ) then return false; end if;

  if exists (
    select required.column_name
    from (values
      ('business_unit_id'), ('customer_id'), ('customer_email'), ('source_channel'),
      ('currency'), ('payment_status'), ('shipping_zone_id'), ('shipping_zone_name'),
      ('nombre_cliente'), ('telefono'), ('direccion'), ('comuna'), ('fecha_entrega'),
      ('items'), ('subtotal'), ('total'), ('estado'), ('metodopago'), ('costo_envio'),
      ('external_token'), ('notas'), ('updated_at')
    ) as required(column_name)
    where not exists (
      select 1 from pg_catalog.pg_attribute a
      join pg_catalog.pg_class c on c.oid = a.attrelid
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'pedidos'
        and a.attname = required.column_name and not a.attisdropped
    )
  ) then return false; end if;

  select exists (
    select 1 from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'checkout_create_order_v2'
      and pg_catalog.pg_get_function_identity_arguments(p.oid) like 'p_idempotency_key text%'
  ) into has_checkout_rpc;

  select exists (
    select 1 from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'descontar_stock_v2'
      and pg_catalog.pg_get_function_identity_arguments(p.oid) = 'p_producto_id uuid, p_cantidad integer'
  ) into has_stock_rpc;

  select exists (
    select 1
      from pg_catalog.pg_indexes
     where schemaname = 'public'
       and tablename = 'carts'
       and indexdef ilike 'CREATE UNIQUE INDEX%checkout_token_hash%'
  ) into has_idempotency_unique;

  return has_checkout_rpc and has_stock_rpc and has_idempotency_unique;
end;
$$;

revoke all on function public.checkout_schema_ready_v2() from public, anon, authenticated;
grant execute on function public.checkout_schema_ready_v2() to service_role;

commit;
