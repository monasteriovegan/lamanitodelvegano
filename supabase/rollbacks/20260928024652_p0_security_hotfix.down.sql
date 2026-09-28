begin;

drop function if exists public.consume_public_tracking_rate_limit_v1(text, integer, integer);
drop table if exists public.public_tracking_rate_limits;

alter table public._catalog_asset_staging_20260910 disable row level security;
grant all on table public._catalog_asset_staging_20260910 to anon, authenticated;

drop policy if exists pub_insert_zonas on public.zonas_envio;
create policy pub_insert_zonas on public.zonas_envio for insert to public with check (true);
drop policy if exists pub_update_zonas on public.zonas_envio;
create policy pub_update_zonas on public.zonas_envio for update to public using (true);
grant all on table public.zonas_envio to anon, authenticated;

alter function public.admin_conversation_inbox_summary_v1(uuid[]) set search_path = public;
alter function public.attribute_conversation_order_opportunity_v1() set search_path = public;
alter function public.increment_conversation_unread_v1() set search_path = public;
alter function public.mark_conversation_read(uuid) set search_path = public;
alter function public.remy_claim_web_whatsapp_handoff() set search_path = public;
alter function public.set_remy_global_enabled(boolean) set search_path = public, pg_temp;

grant execute on function public.admin_conversation_inbox_summary_v1(uuid[]) to anon, authenticated, service_role;
grant execute on function public.admin_create_order_v1(text, uuid, uuid, text, text, text, text, text, jsonb, jsonb, numeric, text, text, numeric, uuid, text, text, text, text, jsonb) to anon, authenticated, service_role;
grant execute on function public.admin_delete_order_v1(integer, text) to anon, authenticated, service_role;
grant execute on function public.admin_update_order_v1(integer, text, jsonb, jsonb, jsonb) to anon, authenticated, service_role;
grant execute on function public.attribute_conversation_order_opportunity_v1() to anon, authenticated, service_role;
grant execute on function public.checkout_create_order_v2(uuid, uuid, text, text, text, text, text, jsonb, jsonb, numeric, text, numeric, uuid, text, numeric, numeric, integer, jsonb) to anon, authenticated, service_role;
grant execute on function public.checkout_create_order_v2(text, uuid, uuid, text, text, text, text, text, jsonb, jsonb, numeric, text, numeric, uuid, text, numeric, numeric, integer, jsonb) to anon, authenticated, service_role;
grant execute on function public.checkout_schema_ready_v2() to anon, authenticated, service_role;
grant execute on function public.consume_meta_oauth_state(text, uuid) to anon, authenticated, service_role;
grant execute on function public.conversation_create_order_v1(text, uuid, uuid, uuid, text, text, text, text, text, jsonb, jsonb, numeric, text, boolean, numeric, uuid, text, text, text, text, jsonb) to anon, authenticated, service_role;
grant execute on function public.descontar_stock(text, integer) to anon, authenticated, service_role;
grant execute on function public.descontar_stock_v2(uuid, integer) to anon, authenticated, service_role;
grant execute on function public.enforce_unblocked_delivery_date() to public, anon, authenticated, service_role;
grant execute on function public.guard_paid_purchase_conversion_v2() to anon, authenticated, service_role;
grant execute on function public.increment_conversation_unread_v1() to anon, authenticated, service_role;
grant execute on function public.is_admin() to anon, authenticated, service_role;
grant execute on function public.mark_conversation_read(uuid) to anon, authenticated, service_role;
grant execute on function public.remy_cart_mark_interested() to public, anon, authenticated, service_role;
grant execute on function public.remy_cart_sync_recovery_contact() to public, anon, authenticated, service_role;
grant execute on function public.remy_claim_web_whatsapp_handoff() to anon, authenticated, service_role;
grant execute on function public.remy_order_payment_handoff() to public, anon, authenticated, service_role;
grant execute on function public.set_remy_global_enabled(boolean) to anon, authenticated, service_role;
grant execute on function public.sync_conversation_order_link_v1() to anon, authenticated, service_role;

commit;
