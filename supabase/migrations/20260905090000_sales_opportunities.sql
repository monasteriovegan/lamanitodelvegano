begin;

create table if not exists public.sales_opportunities (
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid not null references public.business_units(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  customer_id uuid null references public.omnichannel_contacts(id) on delete set null,
  channel text not null check (channel in ('instagram','whatsapp','web')),
  status text not null default 'open' check (status in ('open','snoozed','dismissed','converted','expired')),
  priority text not null check (priority in ('high','medium','low')),
  stage text not null check (stage in ('payment_pending','cart_abandoned','shipping_or_price_question','product_interest','general_interest')),
  score integer not null default 0,
  reason_code text not null,
  reason_summary text not null,
  source_type text not null default 'unknown' check (source_type in ('ad','organic','unknown')),
  source_campaign text null,
  source_ad text null,
  product_context jsonb not null default '{}'::jsonb,
  last_customer_message_at timestamptz null,
  last_business_message_at timestamptz null,
  last_activity_at timestamptz not null default now(),
  recommended_at timestamptz null,
  recommended_channel text null check (recommended_channel is null or recommended_channel in ('instagram','whatsapp')),
  recommended_message text null,
  followup_count integer not null default 0 check (followup_count between 0 and 2),
  last_followup_at timestamptz null,
  next_followup_at timestamptz null,
  snoozed_until timestamptz null,
  dismissed_at timestamptz null,
  dismissal_reason text null,
  claim_token uuid null,
  claim_expires_at timestamptz null,
  last_provider_message_id text null,
  last_error text null,
  converted_order_id integer null references public.pedidos(id) on delete set null,
  converted_revenue numeric(12,2) null,
  recovered_sale boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sales_opportunities_due_idx
  on public.sales_opportunities (business_unit_id, status, next_followup_at);
create index if not exists sales_opportunities_conversation_idx
  on public.sales_opportunities (conversation_id);
create index if not exists sales_opportunities_converted_order_idx
  on public.sales_opportunities (converted_order_id);
create unique index if not exists sales_opportunities_open_stage_uidx
  on public.sales_opportunities (business_unit_id, conversation_id, stage)
  where status in ('open','snoozed');

alter table public.sales_opportunities enable row level security;
revoke all on table public.sales_opportunities from anon, authenticated;
grant all on table public.sales_opportunities to service_role;

create or replace function public.set_sales_opportunities_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists sales_opportunities_set_updated_at on public.sales_opportunities;
create trigger sales_opportunities_set_updated_at
before update on public.sales_opportunities
for each row execute function public.set_sales_opportunities_updated_at();

commit;
