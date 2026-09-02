begin;

create table if not exists public.business_members (
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid not null references public.business_units(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member', 'support', 'warehouse')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_unit_id, user_id)
);

create index if not exists business_members_user_id_idx
  on public.business_members(user_id);

create table if not exists public.meta_connections (
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid not null references public.business_units(id) on delete cascade,
  provider text not null default 'meta' check (provider = 'meta'),
  external_user_id text,
  access_token_ciphertext text not null,
  access_token_iv text not null,
  access_token_tag text not null,
  granted_scopes text[] not null default '{}',
  token_expires_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'active', 'degraded', 'expired', 'revoked', 'disconnected')),
  last_health_at timestamptz,
  last_error_code text,
  connected_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, business_unit_id)
);

create index if not exists meta_connections_business_unit_id_idx
  on public.meta_connections(business_unit_id);

create table if not exists public.meta_connection_assets (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null,
  business_unit_id uuid not null references public.business_units(id) on delete cascade,
  asset_type text not null check (asset_type in ('business', 'page', 'instagram_account', 'whatsapp_business_account', 'whatsapp_phone_number', 'ad_account', 'dataset')),
  external_id text not null,
  display_name text,
  metadata jsonb not null default '{}'::jsonb,
  selected boolean not null default true,
  subscribed boolean not null default false,
  last_health_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (connection_id, business_unit_id)
    references public.meta_connections(id, business_unit_id) on delete cascade,
  unique (asset_type, external_id),
  unique (connection_id, asset_type, external_id)
);

create index if not exists meta_connection_assets_business_unit_id_idx
  on public.meta_connection_assets(business_unit_id);
create index if not exists meta_connection_assets_connection_id_idx
  on public.meta_connection_assets(connection_id);

create table if not exists public.meta_oauth_states (
  id uuid primary key default gen_random_uuid(),
  state_hash text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  business_unit_id uuid not null references public.business_units(id) on delete cascade,
  requested_capabilities text[] not null default '{}',
  return_path text not null default '/admin/integraciones',
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create index if not exists meta_oauth_states_user_tenant_idx
  on public.meta_oauth_states(user_id, business_unit_id);
create index if not exists meta_oauth_states_expires_at_idx
  on public.meta_oauth_states(expires_at);

create or replace function public.consume_meta_oauth_state(p_state_hash text, p_user_id uuid)
returns table (business_unit_id uuid, requested_capabilities text[], return_path text)
language plpgsql
security definer
set search_path = ''
as $function$
begin
  return query
  update public.meta_oauth_states s
     set consumed_at = now()
   where s.state_hash = p_state_hash
     and s.user_id = p_user_id
     and s.consumed_at is null
     and s.expires_at > now()
  returning s.business_unit_id, s.requested_capabilities, s.return_path;
end
$function$;

revoke all on function public.consume_meta_oauth_state(text, uuid) from public, anon, authenticated;
grant execute on function public.consume_meta_oauth_state(text, uuid) to service_role;

alter table public.business_members enable row level security;
alter table public.meta_connections enable row level security;
alter table public.meta_connection_assets enable row level security;
alter table public.meta_oauth_states enable row level security;

drop policy if exists business_members_read_self on public.business_members;
create policy business_members_read_self on public.business_members
  for select to authenticated
  using ((select auth.uid()) is not null and user_id = (select auth.uid()));

-- Connection secrets and OAuth state are never returned through the Data API.
-- Authenticated UI routes use a server-side client and return sanitized metadata.
revoke all on table public.business_members from anon;
revoke all on table public.meta_connections from anon, authenticated;
revoke all on table public.meta_connection_assets from anon, authenticated;
revoke all on table public.meta_oauth_states from anon, authenticated;
grant select on table public.business_members to authenticated;
grant all on table public.business_members, public.meta_connections,
  public.meta_connection_assets, public.meta_oauth_states to service_role;

-- Safe legacy bootstrap: existing admin users become members only of the
-- already-established La Manito tenant. No content rows are rewritten here.
insert into public.business_members (business_unit_id, user_id, role)
select b.id, a.user_id,
       case when a.rol = 'admin' then 'admin' else 'member' end
  from public.admin_roles a
  join public.business_units b on b.slug = 'la-manito-del-vegano'
on conflict (business_unit_id, user_id) do nothing;

commit;
