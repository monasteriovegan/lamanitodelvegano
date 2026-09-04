begin;

-- Administrative order mutations are executed only by trusted server-side
-- routes after application-level admin authorization. They must never be
-- callable directly through PostgREST by anon/authenticated clients.
revoke all on function public.admin_create_order_v1(
  text, uuid, uuid, text, text, text, text, text, jsonb, jsonb,
  numeric, text, text, numeric, uuid, text, text, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.admin_create_order_v1(
  text, uuid, uuid, text, text, text, text, text, jsonb, jsonb,
  numeric, text, text, numeric, uuid, text, text, text, text, jsonb
) to service_role;

revoke all on function public.admin_update_order_v1(
  integer, text, jsonb, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.admin_update_order_v1(
  integer, text, jsonb, jsonb, jsonb
) to service_role;

commit;
