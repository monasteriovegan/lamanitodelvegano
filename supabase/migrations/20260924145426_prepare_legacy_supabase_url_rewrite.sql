-- Prepares (but does not execute) the replacement of absolute Platform Storage URLs.
-- The forward function must be called manually only after the final HTTPS origin exists:
--   select * from migration_support.apply_legacy_supabase_url_rewrite('https://supabase.example.com');
-- Signed URLs are intentionally preserved for application-level regeneration.

create schema if not exists migration_support;
revoke all on schema migration_support from public, anon, authenticated;

create table if not exists migration_support.legacy_supabase_url_backup_20260924 (
  relation_name text not null,
  record_id text not null,
  column_name text not null,
  old_value jsonb not null,
  backed_up_at timestamptz not null default now(),
  primary key (relation_name, record_id, column_name)
);

revoke all on table migration_support.legacy_supabase_url_backup_20260924
  from public, anon, authenticated;

create or replace function migration_support.apply_legacy_supabase_url_rewrite(new_origin text)
returns table (public_rows_updated bigint, signed_rows_pending bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_origin constant text := 'https://adrydqvahzqjbgtcvlay.supabase.co';
  updated_count bigint := 0;
  step_count bigint := 0;
begin
  if new_origin is null
     or new_origin !~ '^https://[a-z0-9.-]+(:[0-9]+)?$'
     or right(new_origin, 1) = '/' then
    raise exception 'new_origin must be an HTTPS origin without a path or trailing slash';
  end if;

  if exists (select 1 from migration_support.legacy_supabase_url_backup_20260924) then
    raise exception 'legacy URL backup already exists; inspect or roll back before retrying';
  end if;

  insert into migration_support.legacy_supabase_url_backup_20260924
    (relation_name, record_id, column_name, old_value)
  select 'public.ajustes', id::text, 'data', to_jsonb(data)
  from public.ajustes where data::text like '%' || old_origin || '%'
  union all
  select 'public.omnichannel_messages', id::text, 'payload', to_jsonb(payload)
  from public.omnichannel_messages where payload::text like '%' || old_origin || '%'
  union all
  select 'public.productos', id::text, 'imagen_url', to_jsonb(imagen_url)
  from public.productos where imagen_url like '%' || old_origin || '%'
  union all
  select 'public.seasons', id::text, 'banner_image', to_jsonb(banner_image)
  from public.seasons where banner_image like '%' || old_origin || '%'
  union all
  select 'public.wonka_jobs', id::text, 'input', to_jsonb(input)
  from public.wonka_jobs where input::text like '%' || old_origin || '%'
  union all
  select 'public.wonka_messages', id::text, 'metadata', to_jsonb(metadata)
  from public.wonka_messages where metadata::text like '%' || old_origin || '%';

  update public.ajustes
  set data = replace(data::text, old_origin, new_origin)::jsonb
  where data::text like '%' || old_origin || '/storage/v1/object/public/%';
  get diagnostics step_count = row_count;
  updated_count := updated_count + step_count;

  update public.omnichannel_messages
  set payload = replace(payload::text, old_origin, new_origin)::jsonb
  where payload::text like '%' || old_origin || '/storage/v1/object/public/%';
  get diagnostics step_count = row_count;
  updated_count := updated_count + step_count;

  update public.productos
  set imagen_url = replace(imagen_url, old_origin, new_origin)
  where imagen_url like '%' || old_origin || '/storage/v1/object/public/%';
  get diagnostics step_count = row_count;
  updated_count := updated_count + step_count;

  update public.seasons
  set banner_image = replace(banner_image, old_origin, new_origin)
  where banner_image like '%' || old_origin || '/storage/v1/object/public/%';
  get diagnostics step_count = row_count;
  updated_count := updated_count + step_count;

  public_rows_updated := updated_count;
  select count(*) into signed_rows_pending
  from migration_support.legacy_supabase_url_backup_20260924
  where old_value::text like '%' || old_origin || '/storage/v1/object/sign/%';
  return next;
end;
$$;

create or replace function migration_support.rollback_legacy_supabase_url_rewrite()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  restored_count bigint := 0;
  step_count bigint := 0;
begin
  update public.ajustes t set data = b.old_value
  from migration_support.legacy_supabase_url_backup_20260924 b
  where b.relation_name = 'public.ajustes' and b.column_name = 'data' and t.id::text = b.record_id;
  get diagnostics step_count = row_count;
  restored_count := restored_count + step_count;

  update public.omnichannel_messages t set payload = b.old_value
  from migration_support.legacy_supabase_url_backup_20260924 b
  where b.relation_name = 'public.omnichannel_messages' and b.column_name = 'payload' and t.id::text = b.record_id;
  get diagnostics step_count = row_count;
  restored_count := restored_count + step_count;

  update public.productos t set imagen_url = b.old_value #>> '{}'
  from migration_support.legacy_supabase_url_backup_20260924 b
  where b.relation_name = 'public.productos' and b.column_name = 'imagen_url' and t.id::text = b.record_id;
  get diagnostics step_count = row_count;
  restored_count := restored_count + step_count;

  update public.seasons t set banner_image = b.old_value #>> '{}'
  from migration_support.legacy_supabase_url_backup_20260924 b
  where b.relation_name = 'public.seasons' and b.column_name = 'banner_image' and t.id::text = b.record_id;
  get diagnostics step_count = row_count;
  restored_count := restored_count + step_count;

  update public.wonka_jobs t set input = b.old_value
  from migration_support.legacy_supabase_url_backup_20260924 b
  where b.relation_name = 'public.wonka_jobs' and b.column_name = 'input' and t.id::text = b.record_id;
  get diagnostics step_count = row_count;
  restored_count := restored_count + step_count;

  update public.wonka_messages t set metadata = b.old_value
  from migration_support.legacy_supabase_url_backup_20260924 b
  where b.relation_name = 'public.wonka_messages' and b.column_name = 'metadata' and t.id::text = b.record_id;
  get diagnostics step_count = row_count;
  restored_count := restored_count + step_count;

  return restored_count;
end;
$$;

revoke all on function migration_support.apply_legacy_supabase_url_rewrite(text)
  from public, anon, authenticated;
revoke all on function migration_support.rollback_legacy_supabase_url_rewrite()
  from public, anon, authenticated;
