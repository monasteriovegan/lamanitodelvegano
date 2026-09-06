create or replace function public.set_remy_global_enabled(p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.integraciones_secretas
  set ai_enabled = p_enabled,
      updated_at = now()
  where id = 'global';

  if not found then
    raise exception 'remy_global_config_missing';
  end if;

  update public.agent_runtime_configs
  set enabled = p_enabled,
      updated_at = now()
  where agent = 'remy';

  if not found then
    raise exception 'remy_runtime_config_missing';
  end if;
end;
$$;

revoke all on function public.set_remy_global_enabled(boolean) from public, anon, authenticated;
grant execute on function public.set_remy_global_enabled(boolean) to service_role;

comment on function public.set_remy_global_enabled(boolean) is
  'Atomically synchronizes the canonical Remy hard gate with its runtime mirror. Service role only.';
