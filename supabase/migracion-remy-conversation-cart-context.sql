alter table public.carritos_abandonados
  add column if not exists business_unit_id uuid references public.business_units(id) on delete set null,
  add column if not exists conversation_id uuid references public.conversations(id) on delete set null,
  add column if not exists customer_id uuid references public.omnichannel_contacts(id) on delete set null,
  add column if not exists source_channel text,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists order_id integer references public.pedidos(id) on delete set null;

update public.carritos_abandonados
set business_unit_id = (
  select id from public.business_units where slug = 'la-manito-del-vegano' limit 1
)
where business_unit_id is null;

create index if not exists idx_carritos_business_identifier
  on public.carritos_abandonados (business_unit_id, identificador, recuperado, last_activity_at desc);
create index if not exists idx_carritos_conversation
  on public.carritos_abandonados (conversation_id, recuperado, last_activity_at desc);
