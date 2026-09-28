begin;

-- P0-1: a Platform -> self-hosted restore reintroduced EXECUTE grants for
-- anon/authenticated on every public SECURITY DEFINER function. All runtime
-- callers were inventoried before this migration. Public checkout is a server
-- route and invokes its RPC with service_role; it does not require anon EXECUTE.

revoke all on function public.admin_conversation_inbox_summary_v1(uuid[]) from public, anon, authenticated;
revoke all on function public.admin_create_order_v1(text, uuid, uuid, text, text, text, text, text, jsonb, jsonb, numeric, text, text, numeric, uuid, text, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.admin_delete_order_v1(integer, text) from public, anon, authenticated;
revoke all on function public.admin_update_order_v1(integer, text, jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.attribute_conversation_order_opportunity_v1() from public, anon, authenticated;
revoke all on function public.checkout_create_order_v2(uuid, uuid, text, text, text, text, text, jsonb, jsonb, numeric, text, numeric, uuid, text, numeric, numeric, integer, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.checkout_create_order_v2(text, uuid, uuid, text, text, text, text, text, jsonb, jsonb, numeric, text, numeric, uuid, text, numeric, numeric, integer, jsonb) from public, anon, authenticated;
revoke all on function public.checkout_schema_ready_v2() from public, anon, authenticated;
revoke all on function public.consume_meta_oauth_state(text, uuid) from public, anon, authenticated;
revoke all on function public.conversation_create_order_v1(text, uuid, uuid, uuid, text, text, text, text, text, jsonb, jsonb, numeric, text, boolean, numeric, uuid, text, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.descontar_stock(text, integer) from public, anon, authenticated, service_role;
revoke all on function public.descontar_stock_v2(uuid, integer) from public, anon, authenticated;
revoke all on function public.enforce_unblocked_delivery_date() from public, anon, authenticated;
revoke all on function public.guard_paid_purchase_conversion_v2() from public, anon, authenticated;
revoke all on function public.increment_conversation_unread_v1() from public, anon, authenticated;
revoke all on function public.is_admin() from public, anon, authenticated;
revoke all on function public.mark_conversation_read(uuid) from public, anon, authenticated;
revoke all on function public.remy_cart_mark_interested() from public, anon, authenticated;
revoke all on function public.remy_cart_sync_recovery_contact() from public, anon, authenticated;
revoke all on function public.remy_claim_web_whatsapp_handoff() from public, anon, authenticated;
revoke all on function public.remy_order_payment_handoff() from public, anon, authenticated;
revoke all on function public.set_remy_global_enabled(boolean) from public, anon, authenticated;
revoke all on function public.sync_conversation_order_link_v1() from public, anon, authenticated;

grant execute on function public.admin_conversation_inbox_summary_v1(uuid[]) to service_role;
grant execute on function public.admin_create_order_v1(text, uuid, uuid, text, text, text, text, text, jsonb, jsonb, numeric, text, text, numeric, uuid, text, text, text, text, jsonb) to service_role;
grant execute on function public.admin_delete_order_v1(integer, text) to service_role;
grant execute on function public.admin_update_order_v1(integer, text, jsonb, jsonb, jsonb) to service_role;
grant execute on function public.attribute_conversation_order_opportunity_v1() to service_role;
grant execute on function public.checkout_create_order_v2(text, uuid, uuid, text, text, text, text, text, jsonb, jsonb, numeric, text, numeric, uuid, text, numeric, numeric, integer, jsonb) to service_role;
grant execute on function public.checkout_schema_ready_v2() to service_role;
grant execute on function public.consume_meta_oauth_state(text, uuid) to service_role;
grant execute on function public.conversation_create_order_v1(text, uuid, uuid, uuid, text, text, text, text, text, jsonb, jsonb, numeric, text, boolean, numeric, uuid, text, text, text, text, jsonb) to service_role;
grant execute on function public.descontar_stock_v2(uuid, integer) to service_role;
grant execute on function public.enforce_unblocked_delivery_date() to service_role;
grant execute on function public.guard_paid_purchase_conversion_v2() to service_role;
grant execute on function public.increment_conversation_unread_v1() to service_role;
grant execute on function public.is_admin() to authenticated, service_role;
grant execute on function public.mark_conversation_read(uuid) to service_role;
grant execute on function public.remy_cart_mark_interested() to service_role;
grant execute on function public.remy_cart_sync_recovery_contact() to service_role;
grant execute on function public.remy_claim_web_whatsapp_handoff() to service_role;
grant execute on function public.remy_order_payment_handoff() to service_role;
grant execute on function public.set_remy_global_enabled(boolean) to service_role;
grant execute on function public.sync_conversation_order_link_v1() to service_role;

-- All referenced relations in these definitions are schema-qualified. Tighten
-- the restored search_path without replacing function bodies.
alter function public.admin_conversation_inbox_summary_v1(uuid[]) set search_path = '';
alter function public.attribute_conversation_order_opportunity_v1() set search_path = '';
alter function public.increment_conversation_unread_v1() set search_path = '';
alter function public.mark_conversation_read(uuid) set search_path = '';
alter function public.remy_claim_web_whatsapp_handoff() set search_path = '';
alter function public.set_remy_global_enabled(boolean) set search_path = '';

-- P0-2 support: a database-backed fixed-window limiter works across Vercel
-- instances. It stores only an HMAC fingerprint, never an IP or user-agent.
create table if not exists public.public_tracking_rate_limits (
  key_hash text primary key check (key_hash ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.public_tracking_rate_limits enable row level security;
revoke all on table public.public_tracking_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on table public.public_tracking_rate_limits to service_role;

create or replace function public.consume_public_tracking_rate_limit_v1(
  p_key_hash text,
  p_limit integer default 10,
  p_window_seconds integer default 60
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  allowed boolean;
begin
  if p_key_hash !~ '^[a-f0-9]{64}$'
     or p_limit < 1 or p_limit > 100
     or p_window_seconds < 1 or p_window_seconds > 3600 then
    return false;
  end if;

  insert into public.public_tracking_rate_limits as limits (
    key_hash, window_started_at, request_count, updated_at
  ) values (
    p_key_hash, pg_catalog.now(), 1, pg_catalog.now()
  )
  on conflict (key_hash) do update
    set window_started_at = case
          when limits.window_started_at <= pg_catalog.now() - pg_catalog.make_interval(secs => p_window_seconds)
            then pg_catalog.now()
          else limits.window_started_at
        end,
        request_count = case
          when limits.window_started_at <= pg_catalog.now() - pg_catalog.make_interval(secs => p_window_seconds)
            then 1
          else limits.request_count + 1
        end,
        updated_at = pg_catalog.now()
  returning request_count <= p_limit into allowed;

  return allowed;
end;
$$;

revoke all on function public.consume_public_tracking_rate_limit_v1(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_public_tracking_rate_limit_v1(text, integer, integer) to service_role;

-- P2 defense in depth. Neither legacy table has a runtime caller.
alter table public._catalog_asset_staging_20260910 enable row level security;
revoke all on table public._catalog_asset_staging_20260910 from anon, authenticated;

drop policy if exists pub_insert_zonas on public.zonas_envio;
drop policy if exists pub_update_zonas on public.zonas_envio;
revoke all on table public.zonas_envio from anon, authenticated;
grant select on table public.zonas_envio to anon, authenticated;

notify pgrst, 'reload schema';

commit;
