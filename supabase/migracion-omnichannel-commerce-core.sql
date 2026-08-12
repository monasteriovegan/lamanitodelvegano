-- Omnichannel Commerce Core — aditiva, idempotente y con IA apagada.
begin;
create extension if not exists pgcrypto;

do $$
declare required_table text; actual_type text;
begin
  foreach required_table in array array['businesses','customers','pedidos','orders','crm_activities','productos'] loop
    if to_regclass('public.'||required_table) is null then
      raise exception 'omnichannel_preflight_missing_table:%', required_table;
    end if;
  end loop;
  select data_type into actual_type from information_schema.columns where table_schema='public' and table_name='businesses' and column_name='id';
  if actual_type <> 'uuid' then raise exception 'omnichannel_preflight_type_mismatch:businesses.id:%',actual_type; end if;
  select data_type into actual_type from information_schema.columns where table_schema='public' and table_name='customers' and column_name='id';
  if actual_type <> 'uuid' then raise exception 'omnichannel_preflight_type_mismatch:customers.id:%',actual_type; end if;
  select data_type into actual_type from information_schema.columns where table_schema='public' and table_name='orders' and column_name='id';
  if actual_type <> 'uuid' then raise exception 'omnichannel_preflight_type_mismatch:orders.id:%',actual_type; end if;
  select data_type into actual_type from information_schema.columns where table_schema='public' and table_name='productos' and column_name='id';
  if actual_type <> 'text' then raise exception 'omnichannel_preflight_type_mismatch:productos.id:%',actual_type; end if;
  if to_regprocedure('public.is_admin()') is null then raise exception 'omnichannel_preflight_missing_function:is_admin'; end if;
end $$;

create table if not exists customer_identities (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references businesses(id) on delete cascade,
  customer_id uuid not null references customers(id) on delete cascade,
  channel text not null check (channel in ('whatsapp','instagram','messenger','web','manual')),
  identity_type text not null check (identity_type in ('phone','email','platform_user_id','cookie')),
  external_id text, normalized_value text not null, verified boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (business_id, channel, identity_type, normalized_value)
);

create table if not exists crm_conversations (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references businesses(id) on delete cascade,
  customer_id uuid references customers(id) on delete set null, channel text not null,
  external_thread_id text not null, external_username text, status text not null default 'open',
  ai_mode text not null default 'human' check (ai_mode in ('human','manual_ai','auto')),
  active_cart_id uuid, last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (business_id, channel, external_thread_id)
);
alter table crm_conversations add column if not exists active_cart_id uuid;
alter table crm_conversations add column if not exists ai_mode text not null default 'human';

create table if not exists crm_messages (
  id uuid primary key default gen_random_uuid(), conversation_id uuid not null references crm_conversations(id) on delete cascade,
  channel text not null default 'whatsapp', provider text not null, transport text not null,
  provider_message_id text not null, external_message_id text, external_thread_id text,
  direction text not null check (direction in ('inbound','outbound')),
  sender_type text not null check (sender_type in ('customer','human','remy','system')),
  text text, message_type text not null default 'text', raw_payload jsonb not null default '{}'::jsonb,
  sent_at timestamptz not null, created_at timestamptz not null default now(),
  unique (provider, transport, provider_message_id)
);
alter table crm_messages add column if not exists provider text not null default 'legacy';
alter table crm_messages add column if not exists transport text not null default 'legacy';
alter table crm_messages add column if not exists provider_message_id text;
alter table crm_messages add column if not exists external_thread_id text;
alter table crm_messages add column if not exists channel text not null default 'whatsapp';
update crm_messages set provider_message_id=coalesce(provider_message_id,external_message_id,id::text) where provider_message_id is null;
do $$ begin
  if exists(select 1 from crm_messages group by provider,transport,provider_message_id having count(*)>1) then
    raise exception 'omnichannel_preflight_duplicate_provider_messages';
  end if;
end $$;
create unique index if not exists crm_messages_provider_transport_message_uidx on crm_messages(provider,transport,provider_message_id);

create table if not exists crm_ai_settings (
  business_id uuid primary key references businesses(id) on delete cascade,
  automatic_ai_enabled boolean not null default false, updated_at timestamptz not null default now()
);
insert into crm_ai_settings(business_id,automatic_ai_enabled)
select id,false from businesses where slug='la-manito-del-vegano' on conflict(business_id) do update set automatic_ai_enabled=false;

create table if not exists carts (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references businesses(id) on delete cascade,
  customer_id uuid references customers(id) on delete set null,
  status text not null default 'active' check(status in ('active','checkout','converted','abandoned','expired')),
  source_channel text not null default 'web', currency text not null default 'CLP', subtotal numeric(12,2) not null default 0,
  discount_total numeric(12,2) not null default 0, shipping_total numeric(12,2) not null default 0, total numeric(12,2) not null default 0,
  checkout_token_hash text unique, expires_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists carts_one_active_customer_idx on carts(business_id,customer_id) where status='active' and customer_id is not null;
do $$ begin
  if not exists(select 1 from pg_constraint where conname='crm_conversations_active_cart_id_fkey' and conrelid='crm_conversations'::regclass) then
    alter table crm_conversations add constraint crm_conversations_active_cart_id_fkey foreign key(active_cart_id) references carts(id) on delete set null;
  end if;
end $$;

create table if not exists cart_items (
  id uuid primary key default gen_random_uuid(), cart_id uuid not null references carts(id) on delete cascade,
  product_id text not null references productos(id) on delete restrict, variant_key text not null default '', quantity integer not null check(quantity>0),
  unit_price_snapshot numeric(12,2) not null, product_name_snapshot text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(cart_id,product_id,variant_key)
);

create table if not exists cart_attribution (
  cart_id uuid primary key references carts(id) on delete cascade, customer_id uuid references customers(id) on delete set null,
  fbclid text, fbc text, fbp text, gclid text, gbraid text, wbraid text,
  utm_source text, utm_medium text, utm_campaign text, utm_content text, utm_term text,
  landing_url text, referrer text, first_touch_at timestamptz not null default now(), last_touch_at timestamptz not null default now()
);

create table if not exists crm_conversation_orders (
  conversation_id uuid not null references crm_conversations(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade, created_at timestamptz not null default now(), primary key(conversation_id,order_id)
);
alter table crm_conversation_orders add column if not exists order_id uuid;
do $$ begin
  if not exists(select 1 from pg_constraint where conname='crm_conversation_orders_order_id_fkey' and conrelid='crm_conversation_orders'::regclass) then
    alter table crm_conversation_orders add constraint crm_conversation_orders_order_id_fkey foreign key(order_id) references orders(id) on delete cascade;
  end if;
end $$;

create table if not exists conversion_events (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references businesses(id) on delete cascade,
  customer_id uuid references customers(id) on delete set null, conversation_id uuid references crm_conversations(id) on delete set null,
  cart_id uuid references carts(id) on delete set null, order_id uuid references orders(id) on delete set null,
  event_name text not null, value numeric(12,2), currency text not null default 'CLP', source_channel text,
  event_time timestamptz not null default now(), meta_status text not null default 'pending', google_status text not null default 'pending',
  ga4_status text not null default 'pending', attempts integer not null default 0, last_error text, created_at timestamptz not null default now(), sent_at timestamptz,
  unique(order_id,event_name)
);

create table if not exists messaging_transport_status (
  transport text primary key, status text not null default 'pending', last_inbound_at timestamptz,
  last_outbound_at timestamptz, last_error text, updated_at timestamptz not null default now()
);
insert into messaging_transport_status(transport,status) values('cloud_api','pending'),('baileys','pending') on conflict do nothing;

create index if not exists customer_identities_customer_idx on customer_identities(customer_id);
create index if not exists crm_conversations_last_idx on crm_conversations(business_id,last_message_at desc);
create index if not exists crm_messages_conversation_idx on crm_messages(conversation_id,sent_at);
create index if not exists carts_customer_idx on carts(customer_id,status);
create index if not exists conversion_events_pending_idx on conversion_events(meta_status,google_status,ga4_status);

do $$ declare t text; begin foreach t in array array['customer_identities','crm_conversations','crm_messages','crm_ai_settings','carts','cart_items','cart_attribution','crm_conversation_orders','conversion_events','messaging_transport_status'] loop execute format('alter table %I enable row level security',t); begin execute format('create policy %I on %I for all to authenticated using (is_admin()) with check (is_admin())','admins_manage_'||t,t); exception when duplicate_object then null; end; end loop; end $$;

commit;
