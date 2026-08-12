-- Puente omnicanal -> CRM + control de IA sin consumo obligatorio de tokens
create extension if not exists pgcrypto;

create table if not exists crm_conversations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  customer_id uuid references customers(id) on delete set null,
  channel text not null check (channel in ('whatsapp','instagram','messenger','web','manual')),
  external_thread_id text not null,
  external_username text,
  status text not null default 'open' check (status in ('open','pending','closed')),
  ai_mode text not null default 'human' check (ai_mode in ('human','manual_ai','auto')),
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, channel, external_thread_id)
);

alter table crm_conversations add column if not exists ai_mode text not null default 'human';

create table if not exists crm_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references crm_conversations(id) on delete cascade,
  external_message_id text not null,
  direction text not null check (direction in ('inbound','outbound')),
  sender_type text not null default 'customer' check (sender_type in ('customer','human','remy','system')),
  text text,
  message_type text not null default 'text',
  raw_payload jsonb,
  sent_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (conversation_id, external_message_id)
);

create table if not exists crm_ai_settings (
  business_id uuid primary key references businesses(id) on delete cascade,
  automatic_ai_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists crm_conversation_orders (
  conversation_id uuid not null references crm_conversations(id) on delete cascade,
  pedido_id text not null references pedidos(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (conversation_id, pedido_id)
);

create index if not exists idx_crm_conversations_last_message on crm_conversations (business_id, last_message_at desc);
create index if not exists idx_crm_messages_conversation_sent on crm_messages (conversation_id, sent_at asc);

alter table crm_conversations enable row level security;
alter table crm_messages enable row level security;
alter table crm_ai_settings enable row level security;
alter table crm_conversation_orders enable row level security;

do $$ begin
  create policy "admins manage crm conversations" on crm_conversations for all using (is_admin()) with check (is_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "admins manage crm messages" on crm_messages for all using (is_admin()) with check (is_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "admins manage crm ai settings" on crm_ai_settings for all using (is_admin()) with check (is_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "admins manage crm conversation orders" on crm_conversation_orders for all using (is_admin()) with check (is_admin());
exception when duplicate_object then null; end $$;

insert into crm_ai_settings (business_id, automatic_ai_enabled)
select id, false from businesses where slug = 'la-manito-del-vegano'
on conflict (business_id) do nothing;
