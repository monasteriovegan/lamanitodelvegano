-- Omnichannel reconciled v2
--
-- IMPORTANTE:
--   * Este archivo reemplaza v1 y se prepara para aplicacion controlada.
--   * El schema real de Supabase es la fuente de verdad.
--   * pedidos (integer) sigue siendo la orden canonica.
--   * business_units, omnichannel_contacts, conversations y
--     omnichannel_messages se reutilizan; no se crean modelos paralelos.
--   * No hay DML sobre informacion de negocio existente.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

-- ---------------------------------------------------------------------------
-- 1. Preflight fuerte. Cualquier incompatibilidad aborta la transaccion antes
--    de tocar el schema.
-- ---------------------------------------------------------------------------

do $preflight$
declare
  required_table text;
  forbidden_table text;
  expected record;
  actual_udt text;
  required_policy record;
  has_conflict boolean;
begin
  foreach required_table in array array[
    'admin_roles',
    'business_units',
    'omnichannel_contacts',
    'conversations',
    'omnichannel_messages',
    'productos',
    'pedidos',
    'categorias',
    'zonas',
    'ajustes',
    'configuracion',
    'cupones'
  ] loop
    if to_regclass('public.' || required_table) is null then
      raise exception 'reconciled_preflight_missing_table:%', required_table;
    end if;
  end loop;

  -- Estos nombres representarian modelos paralelos y bloquearian esta version.
  foreach forbidden_table in array array[
    'businesses',
    'customers',
    'orders',
    'order_items',
    'crm_conversations',
    'crm_messages',
    'messages'
  ] loop
    if to_regclass('public.' || forbidden_table) is not null then
      raise exception 'reconciled_preflight_parallel_model:%', forbidden_table;
    end if;
  end loop;

  for expected in
    select * from (values
      ('admin_roles','user_id','uuid'),
      ('business_units','id','uuid'),
      ('business_units','slug','text'),
      ('omnichannel_contacts','id','uuid'),
      ('omnichannel_contacts','business_unit_id','uuid'),
      ('omnichannel_contacts','channel','text'),
      ('omnichannel_contacts','external_id','text'),
      ('conversations','id','uuid'),
      ('conversations','business_unit_id','uuid'),
      ('conversations','channel','text'),
      ('conversations','external_conversation_id','text'),
      ('conversations','contact_id','text'),
      ('omnichannel_messages','id','uuid'),
      ('omnichannel_messages','conversation_id','uuid'),
      ('omnichannel_messages','direction','text'),
      ('omnichannel_messages','external_message_id','text'),
      ('productos','id','uuid'),
      ('productos','nombre','text'),
      ('productos','precio','int4'),
      ('pedidos','id','int4'),
      ('pedidos','items','jsonb'),
      ('pedidos','total','int4'),
      ('pedidos','estado','text'),
      ('pedidos','created_at','timestamp'),
      ('categorias','id','text'),
      ('zonas','id','uuid')
    ) as v(table_name, column_name, expected_udt)
  loop
    select c.udt_name
      into actual_udt
      from information_schema.columns c
     where c.table_schema = 'public'
       and c.table_name = expected.table_name
       and c.column_name = expected.column_name;

    if actual_udt is distinct from expected.expected_udt then
      raise exception 'reconciled_preflight_type:%:%:expected=%:actual=%',
        expected.table_name,
        expected.column_name,
        expected.expected_udt,
        coalesce(actual_udt, 'missing');
    end if;
  end loop;

  -- Columnas aditivas: si ya existen por una ejecucion parcial o un cambio
  -- externo, deben tener exactamente el tipo reconciliado.
  for expected in
    select * from (values
      ('productos','category_id','text'),
      ('productos','compare_price','numeric'),
      ('productos','cost_price','numeric'),
      ('productos','sku','text'),
      ('productos','low_stock_alert','int4'),
      ('productos','weight_grams','int4'),
      ('productos','story','text'),
      ('productos','images','_text'),
      ('productos','ingredients','_text'),
      ('productos','allergens','_text'),
      ('productos','is_new','bool'),
      ('productos','is_featured','bool'),
      ('pedidos','business_unit_id','uuid'),
      ('pedidos','customer_id','uuid'),
      ('pedidos','customer_email','text'),
      ('pedidos','source_channel','text'),
      ('pedidos','currency','text'),
      ('pedidos','payment_status','text'),
      ('pedidos','discount_total','numeric'),
      ('pedidos','loyalty_discount','numeric'),
      ('pedidos','loyalty_points_redeemed','int4'),
      ('pedidos','loyalty_points_earned','int4'),
      ('pedidos','shipping_zone_id','uuid'),
      ('pedidos','shipping_zone_name','text'),
      ('pedidos','tracking_number','text'),
      ('pedidos','admin_notes','text'),
      ('pedidos','updated_at','timestamptz'),
      ('omnichannel_contacts','email','text'),
      ('omnichannel_contacts','phone','text'),
      ('omnichannel_contacts','nombre','text'),
      ('omnichannel_contacts','direccion','text'),
      ('omnichannel_contacts','crm_status','text'),
      ('omnichannel_contacts','total_spent','numeric'),
      ('omnichannel_contacts','total_orders','int4'),
      ('omnichannel_contacts','last_order_at','timestamptz'),
      ('conversations','customer_id','uuid'),
      ('conversations','provider','text'),
      ('conversations','transport','text'),
      ('conversations','order_id','int4'),
      ('conversations','status','text'),
      ('conversations','metadata','jsonb'),
      ('omnichannel_messages','provider','text'),
      ('omnichannel_messages','transport','text'),
      ('omnichannel_messages','provider_message_id','text'),
      ('omnichannel_messages','customer_id','uuid'),
      ('omnichannel_messages','order_id','int4'),
      ('omnichannel_messages','sent_at','timestamptz'),
      ('omnichannel_messages','delivered_at','timestamptz'),
      ('omnichannel_messages','read_at','timestamptz')
    ) as v(table_name, column_name, expected_udt)
  loop
    select c.udt_name
      into actual_udt
      from information_schema.columns c
     where c.table_schema = 'public'
       and c.table_name = expected.table_name
       and c.column_name = expected.column_name;

    if found and actual_udt is distinct from expected.expected_udt then
      raise exception 'reconciled_preflight_additive_type:%:%:expected=%:actual=%',
        expected.table_name,
        expected.column_name,
        expected.expected_udt,
        actual_udt;
    end if;
  end loop;

  if to_regprocedure('public.is_admin()') is null then
    raise exception 'reconciled_preflight_missing_function:is_admin';
  end if;

  if not exists (
    select 1
      from public.business_units
     where slug = 'la-manito-del-vegano'
  ) then
    raise exception 'reconciled_preflight_missing_business_unit:la-manito-del-vegano';
  end if;

  if exists (
    select 1
      from public.business_units
     where slug = 'la-manito-del-vegano'
     group by slug
    having count(*) > 1
  ) then
    raise exception 'reconciled_preflight_duplicate_business_unit:la-manito-del-vegano';
  end if;

  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public' and table_name = 'productos' and column_name = 'sku'
  ) then
    execute 'select exists (select 1 from public.productos where sku is not null group by sku having count(*) > 1)'
      into has_conflict;
    if has_conflict then
      raise exception 'reconciled_preflight_duplicate_product_sku';
    end if;
  end if;

  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public' and table_name = 'omnichannel_contacts' and column_name = 'email'
  ) then
    execute 'select exists (select 1 from public.omnichannel_contacts where email is not null and btrim(email) <> '''' group by business_unit_id, lower(email) having count(*) > 1)'
      into has_conflict;
    if has_conflict then
      raise exception 'reconciled_preflight_duplicate_contact_email';
    end if;
  end if;

  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public' and table_name = 'omnichannel_contacts' and column_name = 'phone'
  ) then
    execute 'select exists (select 1 from public.omnichannel_contacts where phone is not null and btrim(phone) <> '''' group by business_unit_id, phone having count(*) > 1)'
      into has_conflict;
    if has_conflict then
      raise exception 'reconciled_preflight_duplicate_contact_phone';
    end if;
  end if;

  if exists (
    select 1
      from information_schema.columns
     where table_schema = 'public' and table_name = 'omnichannel_messages' and column_name = 'provider'
  ) and exists (
    select 1
      from information_schema.columns
     where table_schema = 'public' and table_name = 'omnichannel_messages' and column_name = 'transport'
  ) and exists (
    select 1
      from information_schema.columns
     where table_schema = 'public' and table_name = 'omnichannel_messages' and column_name = 'provider_message_id'
  ) then
    execute 'select exists (select 1 from public.omnichannel_messages where provider_message_id is not null group by provider, transport, provider_message_id having count(*) > 1)'
      into has_conflict;
    if has_conflict then
      raise exception 'reconciled_preflight_duplicate_provider_message';
    end if;
  end if;

  -- El hardening depende de estas policies observadas en el schema real.
  for required_policy in
    select * from (values
      ('ajustes','Admin Write Ajustes'),
      ('ajustes','ajustes_select_public'),
      ('configuracion','pub_insert_config'),
      ('configuracion','pub_read_config'),
      ('configuracion','pub_update_config'),
      ('cupones','cupones_select_public'),
      ('pedidos','pub_delete_pedidos'),
      ('pedidos','pub_insert_pedidos'),
      ('pedidos','pub_read_pedidos'),
      ('pedidos','pub_update_pedidos'),
      ('productos','actualizar_productos'),
      ('productos','eliminar_productos'),
      ('productos','insertar_productos'),
      ('productos','leer_productos'),
      ('zonas','actualizar_zonas'),
      ('zonas','eliminar_zonas'),
      ('zonas','insertar_zonas')
    ) as p(table_name, policy_name)
  loop
    if not exists (
      select 1
        from pg_policies p
       where p.schemaname = 'public'
         and p.tablename = required_policy.table_name
         and p.policyname = required_policy.policy_name
    ) then
      raise exception 'reconciled_preflight_missing_policy:%:%',
        required_policy.table_name,
        required_policy.policy_name;
    end if;
  end loop;

  -- Si una ejecucion anterior creo parcialmente un objeto, sus columnas
  -- criticas deben conservar los tipos de esta version.
  for expected in
    select * from (values
      ('customer_identities','id','uuid'),
      ('customer_identities','business_unit_id','uuid'),
      ('customer_identities','customer_id','uuid'),
      ('customer_identities','provider','text'),
      ('customer_identities','external_id','text'),
      ('carts','id','uuid'),
      ('carts','business_unit_id','uuid'),
      ('carts','customer_id','uuid'),
      ('cart_items','cart_id','uuid'),
      ('cart_items','product_id','uuid'),
      ('cart_attribution','cart_id','uuid'),
      ('conversation_orders','conversation_id','uuid'),
      ('conversation_orders','pedido_id','int4'),
      ('conversion_events','id','uuid'),
      ('conversion_events','order_id','int4'),
      ('conversion_events','customer_id','uuid'),
      ('messaging_transport_status','transport','text'),
      ('order_status_history','pedido_id','int4'),
      ('delivery_settings','business_unit_id','uuid'),
      ('blocked_delivery_dates','business_unit_id','uuid'),
      ('crm_activities','customer_id','uuid'),
      ('customer_notes','customer_id','uuid'),
      ('customer_tags','business_unit_id','uuid'),
      ('customer_tag_assignments','customer_id','uuid'),
      ('analytics_events','business_unit_id','uuid'),
      ('ingredients','business_unit_id','uuid'),
      ('recipes','product_id','uuid'),
      ('recipe_ingredients','recipe_id','uuid'),
      ('recipe_ingredients','ingredient_id','uuid'),
      ('store_reservations','business_unit_id','uuid'),
      ('seasons','business_unit_id','uuid'),
      ('season_products','product_id','uuid'),
      ('blog_posts','business_unit_id','uuid'),
      ('contact_messages','business_unit_id','uuid')
    ) as v(table_name, column_name, expected_udt)
  loop
    if to_regclass('public.' || expected.table_name) is not null then
      select c.udt_name
        into actual_udt
        from information_schema.columns c
       where c.table_schema = 'public'
         and c.table_name = expected.table_name
         and c.column_name = expected.column_name;

      if actual_udt is distinct from expected.expected_udt then
        raise exception 'reconciled_preflight_existing_target_type:%:%:expected=%:actual=%',
          expected.table_name,
          expected.column_name,
          expected.expected_udt,
          coalesce(actual_udt, 'missing');
      end if;
    end if;
  end loop;
end
$preflight$;

-- ---------------------------------------------------------------------------
-- 2. Autorizacion administrativa. Se conserva el contrato is_admin(), pero se
--    fija search_path y se limita EXECUTE.
-- ---------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
      from public.admin_roles ar
     where ar.user_id = (select auth.uid())
  );
$function$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Ampliaciones aditivas a las tablas reales.
-- ---------------------------------------------------------------------------

alter table public.productos add column if not exists category_id text;
alter table public.productos add column if not exists compare_price numeric(12,2);
alter table public.productos add column if not exists cost_price numeric(12,2);
alter table public.productos add column if not exists sku text;
alter table public.productos add column if not exists low_stock_alert integer;
alter table public.productos add column if not exists weight_grams integer;
alter table public.productos add column if not exists story text;
alter table public.productos add column if not exists images text[];
alter table public.productos add column if not exists ingredients text[];
alter table public.productos add column if not exists allergens text[];
alter table public.productos add column if not exists is_new boolean;
alter table public.productos add column if not exists is_featured boolean;

do $productos_constraints$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.productos'::regclass
       and conname = 'productos_category_id_fkey'
  ) then
    alter table public.productos
      add constraint productos_category_id_fkey
      foreign key (category_id) references public.categorias(id) on delete set null;
  end if;
end
$productos_constraints$;

create unique index if not exists productos_sku_uidx
  on public.productos (sku)
  where sku is not null;

alter table public.pedidos add column if not exists business_unit_id uuid;
alter table public.pedidos add column if not exists customer_id uuid;
alter table public.pedidos add column if not exists customer_email text;
alter table public.pedidos add column if not exists source_channel text;
alter table public.pedidos add column if not exists currency text;
alter table public.pedidos add column if not exists payment_status text;
alter table public.pedidos add column if not exists discount_total numeric(12,2);
alter table public.pedidos add column if not exists loyalty_discount numeric(12,2);
alter table public.pedidos add column if not exists loyalty_points_redeemed integer;
alter table public.pedidos add column if not exists loyalty_points_earned integer;
alter table public.pedidos add column if not exists shipping_zone_id uuid;
alter table public.pedidos add column if not exists shipping_zone_name text;
alter table public.pedidos add column if not exists tracking_number text;
alter table public.pedidos add column if not exists admin_notes text;
alter table public.pedidos add column if not exists updated_at timestamptz;

do $pedidos_constraints$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.pedidos'::regclass
       and conname = 'pedidos_business_unit_id_fkey'
  ) then
    alter table public.pedidos
      add constraint pedidos_business_unit_id_fkey
      foreign key (business_unit_id) references public.business_units(id) on delete restrict;
  end if;

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.pedidos'::regclass
       and conname = 'pedidos_customer_id_fkey'
  ) then
    alter table public.pedidos
      add constraint pedidos_customer_id_fkey
      foreign key (customer_id) references public.omnichannel_contacts(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.pedidos'::regclass
       and conname = 'pedidos_shipping_zone_id_fkey'
  ) then
    alter table public.pedidos
      add constraint pedidos_shipping_zone_id_fkey
      foreign key (shipping_zone_id) references public.zonas(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.pedidos'::regclass
       and conname = 'pedidos_source_channel_check'
  ) then
    alter table public.pedidos
      add constraint pedidos_source_channel_check
      check (source_channel is null or source_channel in ('web','whatsapp','instagram','messenger','manual','admin'));
  end if;

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.pedidos'::regclass
       and conname = 'pedidos_payment_status_check'
  ) then
    alter table public.pedidos
      add constraint pedidos_payment_status_check
      check (payment_status is null or payment_status in ('pending','paid','failed','refunded','partial'));
  end if;
end
$pedidos_constraints$;

create index if not exists pedidos_business_created_idx
  on public.pedidos (business_unit_id, created_at desc);
create index if not exists pedidos_customer_created_idx
  on public.pedidos (customer_id, created_at desc);

alter table public.omnichannel_contacts add column if not exists email text;
alter table public.omnichannel_contacts add column if not exists phone text;
alter table public.omnichannel_contacts add column if not exists nombre text;
alter table public.omnichannel_contacts add column if not exists direccion text;
alter table public.omnichannel_contacts add column if not exists crm_status text;
alter table public.omnichannel_contacts add column if not exists total_spent numeric(12,2);
alter table public.omnichannel_contacts add column if not exists total_orders integer;
alter table public.omnichannel_contacts add column if not exists last_order_at timestamptz;

do $contact_constraints$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.omnichannel_contacts'::regclass
       and conname = 'omnichannel_contacts_crm_status_check'
  ) then
    alter table public.omnichannel_contacts
      add constraint omnichannel_contacts_crm_status_check
      check (
        crm_status is null or crm_status in (
          'new','contacted','interested','order_started','payment_pending',
          'customer','follow_up','repeat_customer','inactive','lost'
        )
      );
  end if;
end
$contact_constraints$;

create unique index if not exists omnichannel_contacts_business_email_uidx
  on public.omnichannel_contacts (business_unit_id, lower(email))
  where email is not null and btrim(email) <> '';
create unique index if not exists omnichannel_contacts_business_phone_uidx
  on public.omnichannel_contacts (business_unit_id, phone)
  where phone is not null and btrim(phone) <> '';

alter table public.conversations add column if not exists customer_id uuid;
alter table public.conversations add column if not exists provider text;
alter table public.conversations add column if not exists transport text;
alter table public.conversations add column if not exists order_id integer;
alter table public.conversations add column if not exists status text;
alter table public.conversations add column if not exists metadata jsonb;

do $conversation_constraints$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.conversations'::regclass
       and conname = 'conversations_customer_id_fkey'
  ) then
    alter table public.conversations
      add constraint conversations_customer_id_fkey
      foreign key (customer_id) references public.omnichannel_contacts(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.conversations'::regclass
       and conname = 'conversations_order_id_fkey'
  ) then
    alter table public.conversations
      add constraint conversations_order_id_fkey
      foreign key (order_id) references public.pedidos(id) on delete set null;
  end if;
end
$conversation_constraints$;

create index if not exists conversations_customer_last_idx
  on public.conversations (customer_id, last_message_at desc);
create index if not exists conversations_order_idx
  on public.conversations (order_id)
  where order_id is not null;

alter table public.omnichannel_messages add column if not exists provider text;
alter table public.omnichannel_messages add column if not exists transport text;
alter table public.omnichannel_messages add column if not exists provider_message_id text;
alter table public.omnichannel_messages add column if not exists customer_id uuid;
alter table public.omnichannel_messages add column if not exists order_id integer;
alter table public.omnichannel_messages add column if not exists sent_at timestamptz;
alter table public.omnichannel_messages add column if not exists delivered_at timestamptz;
alter table public.omnichannel_messages add column if not exists read_at timestamptz;

do $message_constraints$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.omnichannel_messages'::regclass
       and conname = 'omnichannel_messages_customer_id_fkey'
  ) then
    alter table public.omnichannel_messages
      add constraint omnichannel_messages_customer_id_fkey
      foreign key (customer_id) references public.omnichannel_contacts(id) on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.omnichannel_messages'::regclass
       and conname = 'omnichannel_messages_order_id_fkey'
  ) then
    alter table public.omnichannel_messages
      add constraint omnichannel_messages_order_id_fkey
      foreign key (order_id) references public.pedidos(id) on delete set null;
  end if;
end
$message_constraints$;

create unique index if not exists omnichannel_messages_provider_dedupe_uidx
  on public.omnichannel_messages (provider, transport, provider_message_id)
  where provider_message_id is not null;
create index if not exists omnichannel_messages_conversation_sent_idx
  on public.omnichannel_messages (conversation_id, sent_at desc);

-- ---------------------------------------------------------------------------
-- 4. Identidad central, carrito persistente y Conversion Hub.
-- ---------------------------------------------------------------------------

create table if not exists public.customer_identities (
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid not null,
  customer_id uuid not null,
  provider text not null,
  identity_type text not null,
  external_id text not null,
  normalized_value text not null,
  verified boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_identities_business_unit_id_fkey
    foreign key (business_unit_id) references public.business_units(id) on delete cascade,
  constraint customer_identities_customer_id_fkey
    foreign key (customer_id) references public.omnichannel_contacts(id) on delete cascade,
  constraint customer_identities_provider_external_key
    unique (business_unit_id, provider, external_id),
  constraint customer_identities_type_check
    check (identity_type in ('phone','email','platform_user_id','cookie','manual'))
);

create index if not exists customer_identities_customer_idx
  on public.customer_identities (customer_id);
create index if not exists customer_identities_normalized_idx
  on public.customer_identities (business_unit_id, identity_type, normalized_value);

create table if not exists public.carts (
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid not null,
  customer_id uuid,
  status text not null default 'active',
  source_channel text not null default 'web',
  currency text not null default 'CLP',
  subtotal numeric(12,2) not null default 0,
  discount_total numeric(12,2) not null default 0,
  shipping_total numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  checkout_token_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz,
  constraint carts_business_unit_id_fkey
    foreign key (business_unit_id) references public.business_units(id) on delete cascade,
  constraint carts_customer_id_fkey
    foreign key (customer_id) references public.omnichannel_contacts(id) on delete set null,
  constraint carts_status_check
    check (status in ('active','checkout','converted','abandoned','expired')),
  constraint carts_checkout_token_hash_key unique (checkout_token_hash)
);

create unique index if not exists carts_one_active_customer_uidx
  on public.carts (business_unit_id, customer_id)
  where status = 'active' and customer_id is not null;
create index if not exists carts_customer_status_idx
  on public.carts (customer_id, status);

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null,
  product_id uuid not null,
  variant_key text not null default '',
  quantity integer not null,
  unit_price_snapshot numeric(12,2) not null,
  product_name_snapshot text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cart_items_cart_id_fkey
    foreign key (cart_id) references public.carts(id) on delete cascade,
  constraint cart_items_product_id_fkey
    foreign key (product_id) references public.productos(id) on delete restrict,
  constraint cart_items_quantity_check check (quantity > 0),
  constraint cart_items_cart_product_variant_key unique (cart_id, product_id, variant_key)
);

create table if not exists public.cart_attribution (
  cart_id uuid primary key,
  customer_id uuid,
  fbclid text,
  fbc text,
  fbp text,
  gclid text,
  gbraid text,
  wbraid text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  landing_url text,
  referrer text,
  first_touch_at timestamptz not null default now(),
  last_touch_at timestamptz not null default now(),
  constraint cart_attribution_cart_id_fkey
    foreign key (cart_id) references public.carts(id) on delete cascade,
  constraint cart_attribution_customer_id_fkey
    foreign key (customer_id) references public.omnichannel_contacts(id) on delete set null
);

create table if not exists public.conversation_orders (
  conversation_id uuid not null,
  pedido_id integer not null,
  created_at timestamptz not null default now(),
  primary key (conversation_id, pedido_id),
  constraint conversation_orders_conversation_id_fkey
    foreign key (conversation_id) references public.conversations(id) on delete cascade,
  constraint conversation_orders_pedido_id_fkey
    foreign key (pedido_id) references public.pedidos(id) on delete cascade
);

create table if not exists public.conversion_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  business_unit_id uuid not null,
  customer_id uuid,
  conversation_id uuid,
  cart_id uuid,
  order_id integer,
  event_name text not null,
  source_channel text,
  value numeric(12,2),
  currency text not null default 'CLP',
  fbclid text,
  fbc text,
  fbp text,
  gclid text,
  gbraid text,
  wbraid text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  landing_url text,
  referrer text,
  first_touch_at timestamptz,
  last_touch_at timestamptz,
  status text not null default 'pending',
  provider_results jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  constraint conversion_events_event_id_key unique (business_unit_id, event_id),
  constraint conversion_events_business_unit_id_fkey
    foreign key (business_unit_id) references public.business_units(id) on delete cascade,
  constraint conversion_events_customer_id_fkey
    foreign key (customer_id) references public.omnichannel_contacts(id) on delete set null,
  constraint conversion_events_conversation_id_fkey
    foreign key (conversation_id) references public.conversations(id) on delete set null,
  constraint conversion_events_cart_id_fkey
    foreign key (cart_id) references public.carts(id) on delete set null,
  constraint conversion_events_order_id_fkey
    foreign key (order_id) references public.pedidos(id) on delete set null,
  constraint conversion_events_status_check
    check (status in ('pending','processing','sent','partial','failed','discarded'))
);

create index if not exists conversion_events_pending_idx
  on public.conversion_events (status, created_at)
  where status in ('pending','failed');
create index if not exists conversion_events_order_idx
  on public.conversion_events (order_id)
  where order_id is not null;

create table if not exists public.messaging_transport_status (
  transport text primary key,
  status text not null default 'pending',
  last_inbound_at timestamptz,
  last_outbound_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint messaging_transport_status_status_check
    check (status in ('pending','healthy','degraded','disabled','error'))
);

-- ---------------------------------------------------------------------------
-- 5. Soporte administrativo clasificado como necesario. No se crean aliases
--    businesses/customers/orders; esas lecturas deben pasar por repositories.
-- ---------------------------------------------------------------------------

create table if not exists public.delivery_settings (
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid not null unique,
  enabled_weekdays integer[] not null default array[1,2,3,4,5,6],
  min_advance_days integer not null default 3,
  max_advance_days integer not null default 21,
  cutoff_hour integer not null default 12,
  delivery_message text,
  max_orders_per_day integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint delivery_settings_business_unit_id_fkey
    foreign key (business_unit_id) references public.business_units(id) on delete cascade,
  constraint delivery_settings_weekday_check
    check (enabled_weekdays <@ array[0,1,2,3,4,5,6]),
  constraint delivery_settings_advance_check
    check (min_advance_days >= 0 and max_advance_days >= min_advance_days),
  constraint delivery_settings_cutoff_check check (cutoff_hour between 0 and 23)
);

create table if not exists public.blocked_delivery_dates (
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid not null,
  date date not null,
  reason text,
  created_at timestamptz not null default now(),
  constraint blocked_delivery_dates_business_unit_id_fkey
    foreign key (business_unit_id) references public.business_units(id) on delete cascade,
  constraint blocked_delivery_dates_business_date_key unique (business_unit_id, date)
);

create table if not exists public.customer_notes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null,
  content text not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint customer_notes_customer_id_fkey
    foreign key (customer_id) references public.omnichannel_contacts(id) on delete cascade,
  constraint customer_notes_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete set null
);

create table if not exists public.customer_tags (
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid not null,
  name text not null,
  color text not null default '#00ffb3',
  created_at timestamptz not null default now(),
  constraint customer_tags_business_unit_id_fkey
    foreign key (business_unit_id) references public.business_units(id) on delete cascade,
  constraint customer_tags_business_name_key unique (business_unit_id, name)
);

create table if not exists public.customer_tag_assignments (
  customer_id uuid not null,
  tag_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (customer_id, tag_id),
  constraint customer_tag_assignments_customer_id_fkey
    foreign key (customer_id) references public.omnichannel_contacts(id) on delete cascade,
  constraint customer_tag_assignments_tag_id_fkey
    foreign key (tag_id) references public.customer_tags(id) on delete cascade
);

create table if not exists public.crm_activities (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null,
  type text not null,
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint crm_activities_customer_id_fkey
    foreign key (customer_id) references public.omnichannel_contacts(id) on delete cascade,
  constraint crm_activities_created_by_fkey
    foreign key (created_by) references auth.users(id) on delete set null
);

create index if not exists crm_activities_customer_created_idx
  on public.crm_activities (customer_id, created_at desc);

create table if not exists public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  pedido_id integer not null,
  old_status text,
  new_status text not null,
  payment_status text,
  notes text,
  changed_by uuid,
  created_at timestamptz not null default now(),
  constraint order_status_history_pedido_id_fkey
    foreign key (pedido_id) references public.pedidos(id) on delete cascade,
  constraint order_status_history_changed_by_fkey
    foreign key (changed_by) references auth.users(id) on delete set null
);

create index if not exists order_status_history_pedido_created_idx
  on public.order_status_history (pedido_id, created_at desc);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid not null,
  customer_id uuid,
  event_name text not null,
  event_params jsonb not null default '{}'::jsonb,
  page_path text,
  session_id text,
  created_at timestamptz not null default now(),
  constraint analytics_events_business_unit_id_fkey
    foreign key (business_unit_id) references public.business_units(id) on delete cascade,
  constraint analytics_events_customer_id_fkey
    foreign key (customer_id) references public.omnichannel_contacts(id) on delete set null
);

create index if not exists analytics_events_name_created_idx
  on public.analytics_events (event_name, created_at desc);

create table if not exists public.ingredients (
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid not null,
  name text not null,
  category text,
  unit text not null default 'g',
  cost_per_unit numeric(12,4) not null default 0,
  supplier text,
  is_allergen boolean not null default false,
  allergens text[] not null default '{}',
  notes text,
  calories_per_100g numeric(12,2),
  protein_per_100g numeric(12,2),
  carbs_per_100g numeric(12,2),
  fat_per_100g numeric(12,2),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ingredients_business_unit_id_fkey
    foreign key (business_unit_id) references public.business_units(id) on delete cascade,
  constraint ingredients_business_name_key unique (business_unit_id, name)
);

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid not null,
  name text not null,
  product_id uuid,
  yield_units integer not null default 1,
  yield_description text,
  labor_minutes integer not null default 0,
  overhead_percent numeric(7,2) not null default 15,
  selling_price numeric(12,2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recipes_business_unit_id_fkey
    foreign key (business_unit_id) references public.business_units(id) on delete cascade,
  constraint recipes_product_id_fkey
    foreign key (product_id) references public.productos(id) on delete set null
);

create table if not exists public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null,
  ingredient_id uuid not null,
  quantity numeric(12,4) not null,
  unit text not null default 'g',
  created_at timestamptz not null default now(),
  constraint recipe_ingredients_recipe_id_fkey
    foreign key (recipe_id) references public.recipes(id) on delete cascade,
  constraint recipe_ingredients_ingredient_id_fkey
    foreign key (ingredient_id) references public.ingredients(id) on delete restrict,
  constraint recipe_ingredients_recipe_ingredient_key unique (recipe_id, ingredient_id)
);

create table if not exists public.store_reservations (
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid not null,
  customer_id uuid,
  customer_name text not null,
  customer_email text,
  customer_phone text,
  reservation_date date not null,
  reservation_time text not null,
  party_size integer not null default 1,
  notes text,
  internal_notes text,
  status text not null default 'pending',
  type text not null default 'pickup',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_reservations_business_unit_id_fkey
    foreign key (business_unit_id) references public.business_units(id) on delete cascade,
  constraint store_reservations_customer_id_fkey
    foreign key (customer_id) references public.omnichannel_contacts(id) on delete set null,
  constraint store_reservations_status_check
    check (status in ('pending','confirmed','ready','completed','cancelled'))
);

create table if not exists public.seasons (
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid not null,
  name text not null,
  slug text not null,
  description text,
  starts_at timestamptz,
  ends_at timestamptz,
  color_start text,
  color_end text,
  is_active boolean not null default true,
  banner_image text,
  badge_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seasons_business_unit_id_fkey
    foreign key (business_unit_id) references public.business_units(id) on delete cascade,
  constraint seasons_business_slug_key unique (business_unit_id, slug)
);

create table if not exists public.season_products (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null,
  product_id uuid not null,
  created_at timestamptz not null default now(),
  constraint season_products_season_id_fkey
    foreign key (season_id) references public.seasons(id) on delete cascade,
  constraint season_products_product_id_fkey
    foreign key (product_id) references public.productos(id) on delete cascade,
  constraint season_products_season_product_key unique (season_id, product_id)
);

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid not null,
  title text not null,
  slug text not null,
  excerpt text,
  content text not null,
  cover_image text,
  author_name text,
  category text,
  tags text[],
  is_published boolean not null default false,
  published_at timestamptz,
  meta_title text,
  meta_description text,
  read_time_minutes integer,
  views integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blog_posts_business_unit_id_fkey
    foreign key (business_unit_id) references public.business_units(id) on delete cascade,
  constraint blog_posts_business_slug_key unique (business_unit_id, slug)
);

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid not null,
  customer_id uuid,
  name text not null,
  email text not null,
  phone text,
  subject text,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  constraint contact_messages_business_unit_id_fkey
    foreign key (business_unit_id) references public.business_units(id) on delete cascade,
  constraint contact_messages_customer_id_fkey
    foreign key (customer_id) references public.omnichannel_contacts(id) on delete set null
);

-- Indices del lado referenciante para todas las FK que no quedan cubiertas
-- por una PK, UNIQUE o indice compuesto cuyo primer campo sea la FK.
create index if not exists productos_category_id_idx on public.productos (category_id);
create index if not exists pedidos_shipping_zone_id_idx on public.pedidos (shipping_zone_id);
create index if not exists omnichannel_messages_customer_id_idx on public.omnichannel_messages (customer_id);
create index if not exists omnichannel_messages_order_id_idx on public.omnichannel_messages (order_id);
create index if not exists carts_business_unit_id_idx on public.carts (business_unit_id);
create index if not exists cart_items_product_id_idx on public.cart_items (product_id);
create index if not exists cart_attribution_customer_id_idx on public.cart_attribution (customer_id);
create index if not exists conversation_orders_pedido_id_idx on public.conversation_orders (pedido_id);
create index if not exists conversion_events_business_unit_id_idx on public.conversion_events (business_unit_id);
create index if not exists conversion_events_customer_id_idx on public.conversion_events (customer_id);
create index if not exists conversion_events_conversation_id_idx on public.conversion_events (conversation_id);
create index if not exists conversion_events_cart_id_idx on public.conversion_events (cart_id);
create index if not exists blocked_delivery_dates_business_unit_id_idx on public.blocked_delivery_dates (business_unit_id);
create index if not exists customer_notes_customer_id_idx on public.customer_notes (customer_id);
create index if not exists customer_notes_created_by_idx on public.customer_notes (created_by);
create index if not exists customer_tag_assignments_tag_id_idx on public.customer_tag_assignments (tag_id);
create index if not exists crm_activities_created_by_idx on public.crm_activities (created_by);
create index if not exists order_status_history_changed_by_idx on public.order_status_history (changed_by);
create index if not exists analytics_events_business_unit_id_idx on public.analytics_events (business_unit_id);
create index if not exists analytics_events_customer_id_idx on public.analytics_events (customer_id);
create index if not exists ingredients_business_unit_id_idx on public.ingredients (business_unit_id);
create index if not exists recipes_business_unit_id_idx on public.recipes (business_unit_id);
create index if not exists recipes_product_id_idx on public.recipes (product_id);
create index if not exists recipe_ingredients_ingredient_id_idx on public.recipe_ingredients (ingredient_id);
create index if not exists store_reservations_business_unit_id_idx on public.store_reservations (business_unit_id);
create index if not exists store_reservations_customer_id_idx on public.store_reservations (customer_id);
create index if not exists seasons_business_unit_id_idx on public.seasons (business_unit_id);
create index if not exists season_products_product_id_idx on public.season_products (product_id);
create index if not exists blog_posts_business_unit_id_idx on public.blog_posts (business_unit_id);
create index if not exists contact_messages_business_unit_id_idx on public.contact_messages (business_unit_id);
create index if not exists contact_messages_customer_id_idx on public.contact_messages (customer_id);

-- ---------------------------------------------------------------------------
-- 6. Checkout atomico. Las funciones solo son invocables por service_role.
--    El endpoint server-side recalcula precios; la base vuelve a validar
--    producto, disponibilidad, UUID, cantidad y stock bajo bloqueo de fila.
-- ---------------------------------------------------------------------------

create or replace function public.descontar_stock_v2(
  p_producto_id uuid,
  p_cantidad integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  product_record record;
begin
  if p_cantidad is null or p_cantidad <= 0 then
    raise exception 'invalid_stock_quantity';
  end if;

  select p.id, p.activo, p.maneja_stock, p.stock
    into product_record
    from public.productos p
   where p.id = p_producto_id
   for update;

  if not found or product_record.activo is not true then
    raise exception 'product_not_available:%', p_producto_id;
  end if;

  if product_record.maneja_stock is true then
    if coalesce(product_record.stock, 0) < p_cantidad then
      raise exception 'insufficient_stock:%', p_producto_id;
    end if;

    update public.productos
       set stock = stock - p_cantidad
     where id = p_producto_id;
  end if;

  return true;
end
$function$;

revoke all on function public.descontar_stock_v2(uuid, integer) from public, anon, authenticated;
grant execute on function public.descontar_stock_v2(uuid, integer) to service_role;

create or replace function public.checkout_create_order_v2(
  p_business_unit_id uuid,
  p_customer_id uuid,
  p_customer_email text,
  p_customer_name text,
  p_customer_phone text,
  p_address text,
  p_comuna text,
  p_order_items jsonb,
  p_stock_items jsonb,
  p_total numeric,
  p_payment_method text,
  p_shipping_cost numeric,
  p_shipping_zone_id uuid,
  p_shipping_zone_name text,
  p_discount_total numeric,
  p_loyalty_discount numeric,
  p_loyalty_points_redeemed integer,
  p_attribution jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  item jsonb;
  product_record record;
  product_id uuid;
  item_quantity integer;
  item_price numeric(12,2);
  calculated_subtotal numeric(12,2) := 0;
  cart_id uuid;
  pedido_id integer;
begin
  if p_customer_name is null or btrim(p_customer_name) = ''
     or p_customer_phone is null or btrim(p_customer_phone) = '' then
    raise exception 'missing_customer_data';
  end if;
  if jsonb_typeof(p_stock_items) <> 'array' or jsonb_array_length(p_stock_items) = 0 then
    raise exception 'empty_checkout_items';
  end if;
  if jsonb_typeof(p_order_items) <> 'array' then
    raise exception 'invalid_order_items';
  end if;
  if not exists (
    select 1 from public.business_units b where b.id = p_business_unit_id
  ) then
    raise exception 'business_unit_not_found';
  end if;
  if not exists (
    select 1 from public.omnichannel_contacts c
     where c.id = p_customer_id and c.business_unit_id = p_business_unit_id
  ) then
    raise exception 'customer_not_found';
  end if;

  insert into public.carts (
    business_unit_id, customer_id, status, source_channel, currency,
    subtotal, discount_total, shipping_total, total
  ) values (
    p_business_unit_id, p_customer_id, 'checkout', 'web', 'CLP',
    0, coalesce(p_discount_total, 0), coalesce(p_shipping_cost, 0), p_total
  ) returning id into cart_id;

  for item in select value from jsonb_array_elements(p_stock_items)
  loop
    begin
      product_id := (item ->> 'productoId')::uuid;
      item_quantity := (item ->> 'qty')::integer;
      item_price := (item ->> 'precio')::numeric;
    exception when others then
      raise exception 'invalid_checkout_item';
    end;

    if item_quantity <= 0 or item_price < 0 then
      raise exception 'invalid_checkout_item_values:%', product_id;
    end if;

    select p.id, p.nombre, p.activo
      into product_record
      from public.productos p
     where p.id = product_id
     for update;
    if not found or product_record.activo is not true then
      raise exception 'product_not_available:%', product_id;
    end if;

    perform public.descontar_stock_v2(product_id, item_quantity);
    calculated_subtotal := calculated_subtotal + (item_price * item_quantity);

    insert into public.cart_items (
      cart_id, product_id, variant_key, quantity,
      unit_price_snapshot, product_name_snapshot
    ) values (
      cart_id,
      product_id,
      concat_ws('::', coalesce(item ->> 'formato', ''), coalesce(item ->> 'variedad', '')),
      item_quantity,
      item_price,
      product_record.nombre
    );
  end loop;

  if round(p_total, 2) <> round(
    calculated_subtotal + coalesce(p_shipping_cost, 0) - coalesce(p_discount_total, 0),
    2
  ) then
    raise exception 'checkout_total_mismatch';
  end if;

  update public.carts
     set subtotal = calculated_subtotal,
         total = p_total,
         updated_at = now()
   where id = cart_id;

  insert into public.cart_attribution (
    cart_id, customer_id, fbclid, fbc, fbp, gclid, gbraid, wbraid,
    utm_source, utm_medium, utm_campaign, utm_content, utm_term,
    landing_url, referrer
  ) values (
    cart_id, p_customer_id,
    nullif(p_attribution ->> 'fbclid', ''), nullif(p_attribution ->> 'fbc', ''),
    nullif(p_attribution ->> 'fbp', ''), nullif(p_attribution ->> 'gclid', ''),
    nullif(p_attribution ->> 'gbraid', ''), nullif(p_attribution ->> 'wbraid', ''),
    nullif(p_attribution ->> 'utm_source', ''), nullif(p_attribution ->> 'utm_medium', ''),
    nullif(p_attribution ->> 'utm_campaign', ''), nullif(p_attribution ->> 'utm_content', ''),
    nullif(p_attribution ->> 'utm_term', ''), nullif(p_attribution ->> 'landing_url', ''),
    nullif(p_attribution ->> 'referrer', '')
  );

  insert into public.pedidos (
    business_unit_id, customer_id, customer_email, source_channel, currency,
    payment_status, discount_total, loyalty_discount,
    loyalty_points_redeemed, loyalty_points_earned,
    shipping_zone_id, shipping_zone_name, nombre_cliente, telefono,
    direccion, comuna, items, total, estado, metodopago, costo_envio
  ) values (
    p_business_unit_id, p_customer_id, nullif(lower(btrim(p_customer_email)), ''),
    'web', 'CLP', 'pending', coalesce(p_discount_total, 0),
    coalesce(p_loyalty_discount, 0), coalesce(p_loyalty_points_redeemed, 0), 0,
    p_shipping_zone_id, p_shipping_zone_name, p_customer_name, p_customer_phone,
    p_address, p_comuna, p_order_items, round(p_total)::integer,
    case when p_payment_method = 'whatsapp' then 'WhatsApp' else 'Pendiente' end,
    p_payment_method, round(coalesce(p_shipping_cost, 0))::integer
  ) returning id into pedido_id;

  update public.omnichannel_contacts
     set email = coalesce(nullif(lower(btrim(p_customer_email)), ''), email),
         phone = p_customer_phone,
         nombre = p_customer_name,
         direccion = p_address,
         crm_status = 'customer',
         total_orders = coalesce(total_orders, 0) + 1,
         total_spent = coalesce(total_spent, 0) + p_total,
         last_order_at = now(),
         updated_at = now()
   where id = p_customer_id;

  insert into public.customer_identities (
    business_unit_id, customer_id, provider, identity_type,
    external_id, normalized_value, verified
  ) values (
    p_business_unit_id, p_customer_id, 'manual', 'phone',
    p_customer_phone, p_customer_phone, false
  ) on conflict (business_unit_id, provider, external_id)
    do update set customer_id = excluded.customer_id,
                  normalized_value = excluded.normalized_value,
                  updated_at = now();

  if nullif(lower(btrim(p_customer_email)), '') is not null then
    insert into public.customer_identities (
      business_unit_id, customer_id, provider, identity_type,
      external_id, normalized_value, verified
    ) values (
      p_business_unit_id, p_customer_id, 'manual', 'email',
      lower(btrim(p_customer_email)), lower(btrim(p_customer_email)), false
    ) on conflict (business_unit_id, provider, external_id)
      do update set customer_id = excluded.customer_id,
                    normalized_value = excluded.normalized_value,
                    updated_at = now();
  end if;

  insert into public.crm_activities (customer_id, type, description)
  values (p_customer_id, 'order_created', 'Pedido ' || pedido_id || ' creado por checkout');

  update public.carts
     set status = 'converted', updated_at = now()
   where id = cart_id;

  insert into public.conversion_events (
    event_id, business_unit_id, customer_id, cart_id, order_id,
    event_name, source_channel, value, currency,
    fbclid, fbc, fbp, gclid, gbraid, wbraid,
    utm_source, utm_medium, utm_campaign, utm_content, utm_term,
    landing_url, referrer, first_touch_at, last_touch_at
  ) values (
    'checkout:' || pedido_id, p_business_unit_id, p_customer_id, cart_id, pedido_id,
    'Purchase', 'web', p_total, 'CLP',
    nullif(p_attribution ->> 'fbclid', ''), nullif(p_attribution ->> 'fbc', ''),
    nullif(p_attribution ->> 'fbp', ''), nullif(p_attribution ->> 'gclid', ''),
    nullif(p_attribution ->> 'gbraid', ''), nullif(p_attribution ->> 'wbraid', ''),
    nullif(p_attribution ->> 'utm_source', ''), nullif(p_attribution ->> 'utm_medium', ''),
    nullif(p_attribution ->> 'utm_campaign', ''), nullif(p_attribution ->> 'utm_content', ''),
    nullif(p_attribution ->> 'utm_term', ''), nullif(p_attribution ->> 'landing_url', ''),
    nullif(p_attribution ->> 'referrer', ''), now(), now()
  );

  return jsonb_build_object('pedido_id', pedido_id, 'cart_id', cart_id);
end
$function$;

revoke all on function public.checkout_create_order_v2(
  uuid, uuid, text, text, text, text, text, jsonb, jsonb, numeric, text,
  numeric, uuid, text, numeric, numeric, integer, jsonb
) from public, anon, authenticated;
grant execute on function public.checkout_create_order_v2(
  uuid, uuid, text, text, text, text, text, jsonb, jsonb, numeric, text,
  numeric, uuid, text, numeric, numeric, integer, jsonb
) to service_role;

-- ---------------------------------------------------------------------------
-- 7. RLS y grants explicitos para Data API.
-- ---------------------------------------------------------------------------

do $private_rls$
declare
  table_name text;
  policy_name text;
begin
  foreach table_name in array array[
    'admin_roles',
    'business_units',
    'omnichannel_contacts',
    'conversations',
    'omnichannel_messages',
    'channel_settings',
    'agent_settings',
    'agent_control_audit_logs',
    'automation_decisions',
    'automation_schedules',
    'conversation_notes',
    'crm_sync_queue',
    'meta_webhook_events',
    'customer_identities',
    'carts',
    'cart_items',
    'cart_attribution',
    'conversation_orders',
    'conversion_events',
    'messaging_transport_status',
    'delivery_settings',
    'blocked_delivery_dates',
    'customer_notes',
    'customer_tags',
    'customer_tag_assignments',
    'crm_activities',
    'order_status_history',
    'analytics_events',
    'ingredients',
    'recipes',
    'recipe_ingredients',
    'store_reservations',
    'seasons',
    'season_products',
    'blog_posts',
    'contact_messages'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    policy_name := 'reconciled_admin_' || table_name;

    if not exists (
      select 1
        from pg_policies p
       where p.schemaname = 'public'
         and p.tablename = table_name
         and p.policyname = policy_name
    ) then
      execute format(
        'create policy %I on public.%I for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))',
        policy_name,
        table_name
      );
    end if;

    execute format('revoke all on table public.%I from anon', table_name);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', table_name);
    execute format('grant all on table public.%I to service_role', table_name);
  end loop;
end
$private_rls$;

-- Secrets de integracion: solo backend con service role.
revoke all on table public.integraciones_secretas from anon, authenticated;
grant all on table public.integraciones_secretas to service_role;

-- Carrito legacy, PINs y configuracion sensible: sin acceso anonimo.
revoke all on table public.carritos_abandonados from anon;
revoke all on table public.puntos_pins from anon;
revoke all on table public.ajustes from anon;
revoke all on table public.configuracion from anon;
revoke all on table public.cupones from anon;
grant all on table public.carritos_abandonados, public.puntos_pins, public.ajustes, public.configuracion, public.cupones to service_role;

-- Catalogo publico: solo lectura. Toda escritura pasa por backend/admin.
revoke insert, update, delete, truncate on table public.productos from anon, authenticated;
revoke insert, update, delete, truncate on table public.categorias from anon;
revoke insert, update, delete, truncate on table public.zonas from anon;
grant select on table public.productos, public.categorias, public.zonas to anon, authenticated;
grant insert, update, delete on table public.productos to authenticated;
grant all on table public.productos, public.categorias, public.zonas to service_role;

-- Pedidos: checkout y tracking pasan por APIs server-side.
revoke all on table public.pedidos from anon;
grant select, insert, update, delete on table public.pedidos to authenticated;
grant all on table public.pedidos to service_role;

-- Reescritura no destructiva de las policies inseguras observadas.
alter policy "Admin Write Ajustes" on public.ajustes
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
alter policy ajustes_select_public on public.ajustes
  to authenticated
  using ((select public.is_admin()));

alter policy pub_insert_config on public.configuracion
  to authenticated
  with check ((select public.is_admin()));
alter policy pub_read_config on public.configuracion
  to authenticated
  using ((select public.is_admin()));
alter policy pub_update_config on public.configuracion
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

alter policy cupones_select_public on public.cupones
  to authenticated
  using ((select public.is_admin()));

alter policy pub_delete_pedidos on public.pedidos
  to authenticated
  using ((select public.is_admin()));
alter policy pub_insert_pedidos on public.pedidos
  to authenticated
  with check ((select public.is_admin()));
alter policy pub_read_pedidos on public.pedidos
  to authenticated
  using ((select public.is_admin()));
alter policy pub_update_pedidos on public.pedidos
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

alter policy actualizar_productos on public.productos
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
alter policy eliminar_productos on public.productos
  to authenticated
  using ((select public.is_admin()));
alter policy insertar_productos on public.productos
  to authenticated
  with check ((select public.is_admin()));
alter policy leer_productos on public.productos
  to authenticated
  using ((select public.is_admin()));

do $product_admin_read$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename = 'productos'
       and policyname = 'reconciled_public_select_active_productos'
  ) then
    create policy reconciled_public_select_active_productos on public.productos
      for select to anon, authenticated
      using (activo is true);
  end if;

  if not exists (
    select 1 from pg_policies
     where schemaname = 'public'
       and tablename = 'productos'
       and policyname = 'reconciled_admin_select_productos'
  ) then
    create policy reconciled_admin_select_productos on public.productos
      for select to authenticated
      using ((select public.is_admin()));
  end if;
end
$product_admin_read$;

alter policy actualizar_zonas on public.zonas
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
alter policy eliminar_zonas on public.zonas
  to authenticated
  using ((select public.is_admin()));
alter policy insertar_zonas on public.zonas
  to authenticated
  with check ((select public.is_admin()));

commit;
