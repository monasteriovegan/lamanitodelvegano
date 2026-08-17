-- Memoria persistente selectiva para agentes Synthetiq.
-- Aditiva: no modifica mensajes, CRM, pedidos ni catalogo existentes.

begin;

create table if not exists public.agent_memories (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete cascade,
  business_unit_id uuid references public.business_units(id) on delete cascade,
  agent text not null,
  scope text not null check (scope in ('owner','business','agent','customer','project','conversation')),
  entity_id text,
  memory_key text not null,
  value text not null check (char_length(value) between 1 and 800),
  tags text[] not null default '{}'::text[],
  priority smallint not null default 50 check (priority between 0 and 100),
  pinned boolean not null default false,
  active boolean not null default true,
  source text not null default 'explicit',
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_memories_lookup_idx
  on public.agent_memories (agent, business_unit_id, active, pinned, priority desc, updated_at desc);
create index if not exists agent_memories_owner_idx
  on public.agent_memories (owner_user_id, active, priority desc, updated_at desc);
create index if not exists agent_memories_tags_gin_idx
  on public.agent_memories using gin (tags);

alter table public.agent_memories enable row level security;

drop policy if exists agent_memories_admin_all on public.agent_memories;
create policy agent_memories_admin_all
  on public.agent_memories
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all on public.agent_memories from anon;
grant select, insert, update, delete on public.agent_memories to authenticated;
grant all on public.agent_memories to service_role;

commit;
