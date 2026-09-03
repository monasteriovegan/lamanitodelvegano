create table if not exists public.payment_reconciliation_queue (
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid not null references public.business_units(id) on delete cascade,
  amount integer not null check (amount > 0),
  observed_at timestamptz not null default now(),
  bank text,
  payer_name text,
  evidence jsonb not null default '{}'::jsonb,
  status text not null default 'unmatched' check (status in ('unmatched','linked','dismissed')),
  linked_order_id integer references public.pedidos(id) on delete set null,
  linked_conversation_id uuid references public.conversations(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_reconciliation_queue_status_observed_idx
  on public.payment_reconciliation_queue (status, observed_at desc);

alter table public.payment_reconciliation_queue enable row level security;

create or replace function public.admin_create_order_v1(
  p_idempotency_key text,
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
  p_payment_status text,
  p_shipping_cost numeric,
  p_shipping_zone_id uuid,
  p_shipping_zone_name text,
  p_delivery_date text,
  p_source_channel text,
  p_admin_notes text,
  p_attribution jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  item jsonb;
  product_record record;
  product_id uuid;
  raw_product_id text;
  item_quantity integer;
  item_price numeric(12,2);
  calculated_subtotal numeric(12,2) := 0;
  pedido_id integer;
  existing_order_id integer;
  token_hash text;
  event_key text;
  normalized_phone text;
  normalized_email text;
  normalized_payment_status text;
  normalized_source text;
  resolved_customer_id uuid;
  crm_order_count integer;
  crm_total_spent numeric;
  crm_last_order_at timestamptz;
begin
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'missing_idempotency_key';
  end if;
  if p_customer_name is null or btrim(p_customer_name) = '' then
    raise exception 'missing_customer_name';
  end if;
  if jsonb_typeof(p_order_items) <> 'array' or jsonb_array_length(p_order_items) = 0 then
    raise exception 'empty_admin_order_items';
  end if;
  if jsonb_typeof(p_stock_items) <> 'array' then
    raise exception 'invalid_admin_stock_items';
  end if;
  if coalesce(p_shipping_cost, 0) < 0 or coalesce(p_total, 0) < 0 then
    raise exception 'invalid_admin_order_total';
  end if;
  if not exists (select 1 from public.business_units b where b.id = p_business_unit_id) then
    raise exception 'business_unit_not_found';
  end if;

  normalized_payment_status := lower(btrim(coalesce(p_payment_status, 'pending')));
  if normalized_payment_status not in ('pending','paid','failed','refunded','partial') then
    raise exception 'invalid_payment_status';
  end if;
  normalized_source := lower(btrim(coalesce(p_source_channel, 'manual')));
  if normalized_source not in ('web','whatsapp','instagram','messenger','manual','admin') then
    raise exception 'invalid_source_channel';
  end if;

  token_hash := encode(extensions.digest(p_idempotency_key, 'sha256'), 'hex');
  event_key := 'admin_order:' || token_hash;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(event_key, 0));

  select ce.order_id into existing_order_id
    from public.conversion_events ce
   where ce.business_unit_id = p_business_unit_id
     and ce.event_id = event_key
   limit 1;
  if found and existing_order_id is not null then
    return jsonb_build_object('pedido_id', existing_order_id, 'idempotent_replay', true);
  end if;

  for item in select value from jsonb_array_elements(p_order_items)
  loop
    begin
      item_quantity := (item ->> 'qty')::integer;
      item_price := (item ->> 'precio')::numeric;
      raw_product_id := nullif(btrim(coalesce(item ->> 'productoId', '')), '');
    exception when others then
      raise exception 'invalid_admin_order_item';
    end;
    if item_quantity <= 0 or item_price < 0 then
      raise exception 'invalid_admin_order_item_values';
    end if;

    if raw_product_id is null then
      if coalesce((item ->> 'custom')::boolean, false) is not true
         or nullif(btrim(coalesce(item ->> 'nombre', '')), '') is null then
        raise exception 'invalid_custom_admin_order_item';
      end if;
    else
      begin
        product_id := raw_product_id::uuid;
      exception when others then
        raise exception 'invalid_admin_order_product_id';
      end;
      select p.id, p.nombre, p.activo into product_record
        from public.productos p
       where p.id = product_id and p.business_unit_id = p_business_unit_id;
      if not found or product_record.activo is not true then
        raise exception 'product_not_available:%', product_id;
      end if;
      if not exists (
        select 1 from jsonb_array_elements(p_stock_items) s
         where nullif(btrim(coalesce(s ->> 'productoId', '')), '') = product_id::text
           and coalesce((s ->> 'qty')::integer, 0) = item_quantity
      ) then
        raise exception 'missing_stock_item:%', product_id;
      end if;
    end if;
    calculated_subtotal := calculated_subtotal + item_price * item_quantity;
  end loop;

  if round(p_total, 2) <> round(calculated_subtotal + coalesce(p_shipping_cost, 0), 2) then
    raise exception 'admin_order_total_mismatch';
  end if;

  for item in select value from jsonb_array_elements(p_stock_items)
  loop
    begin
      product_id := (item ->> 'productoId')::uuid;
      item_quantity := (item ->> 'qty')::integer;
    exception when others then
      raise exception 'invalid_admin_stock_item';
    end;
    if item_quantity <= 0 then raise exception 'invalid_admin_stock_quantity'; end if;
    select p.id, p.activo into product_record
      from public.productos p
     where p.id = product_id and p.business_unit_id = p_business_unit_id
     for update;
    if not found or product_record.activo is not true then
      raise exception 'product_not_available:%', product_id;
    end if;
    perform public.descontar_stock_v2(product_id, item_quantity);
  end loop;

  normalized_phone := nullif(btrim(coalesce(p_customer_phone, '')), '');
  normalized_email := nullif(lower(btrim(coalesce(p_customer_email, ''))), '');
  resolved_customer_id := p_customer_id;

  if resolved_customer_id is not null then
    if not exists (
      select 1 from public.omnichannel_contacts c
       where c.id = resolved_customer_id and c.business_unit_id = p_business_unit_id
    ) then
      raise exception 'customer_not_found';
    end if;
  else
    select c.id into resolved_customer_id
      from public.omnichannel_contacts c
     where c.business_unit_id = p_business_unit_id
       and ((normalized_phone is not null and c.phone = normalized_phone)
         or (normalized_email is not null and lower(c.email) = normalized_email))
     order by c.updated_at desc
     limit 1;

    if resolved_customer_id is null then
      insert into public.omnichannel_contacts (
        business_unit_id, channel, external_id, display_name,
        email, phone, nombre, direccion, crm_status,
        total_spent, total_orders, metadata
      ) values (
        p_business_unit_id, 'manual', 'manual:' || token_hash,
        p_customer_name, normalized_email, normalized_phone,
        p_customer_name, nullif(btrim(coalesce(p_address, '')), ''),
        'customer', 0, 0,
        case when nullif(btrim(coalesce(p_comuna, '')), '') is not null
          then jsonb_build_object('comuna', p_comuna)
          else '{}'::jsonb end
      ) returning id into resolved_customer_id;
    end if;
  end if;

  insert into public.pedidos (
    business_unit_id, customer_id, customer_email, source_channel, currency,
    payment_status, discount_total, loyalty_discount,
    loyalty_points_redeemed, loyalty_points_earned,
    shipping_zone_id, shipping_zone_name, nombre_cliente, telefono,
    direccion, comuna, fecha_entrega, items, subtotal, total, estado,
    metodopago, costo_envio, admin_notes
  ) values (
    p_business_unit_id, resolved_customer_id, normalized_email, normalized_source, 'CLP',
    normalized_payment_status, 0, 0, 0, 0,
    p_shipping_zone_id, p_shipping_zone_name, p_customer_name, normalized_phone,
    p_address, p_comuna, p_delivery_date, p_order_items,
    round(calculated_subtotal)::integer, round(p_total)::integer,
    case when normalized_payment_status = 'paid' then 'Pagado' else 'Pendiente' end,
    p_payment_method, round(coalesce(p_shipping_cost, 0))::integer,
    nullif(btrim(coalesce(p_admin_notes, '')), '')
  ) returning id into pedido_id;

  select count(*)::integer,
         coalesce(sum(case when p.payment_status = 'paid' then p.total else 0 end), 0),
         max(p.created_at at time zone 'UTC')
    into crm_order_count, crm_total_spent, crm_last_order_at
    from public.pedidos p
   where p.customer_id = resolved_customer_id
     and lower(coalesce(p.estado, '')) <> 'cancelado';

  update public.omnichannel_contacts
     set email = coalesce(normalized_email, email),
         phone = coalesce(normalized_phone, phone),
         nombre = coalesce(nullif(btrim(p_customer_name), ''), nombre),
         direccion = coalesce(nullif(btrim(coalesce(p_address, '')), ''), direccion),
         metadata = case
           when nullif(btrim(coalesce(p_comuna, '')), '') is not null
             then coalesce(metadata, '{}'::jsonb) || jsonb_build_object('comuna', p_comuna)
           else coalesce(metadata, '{}'::jsonb)
         end,
         crm_status = case when crm_order_count > 1 then 'repeat_customer' else 'customer' end,
         total_orders = crm_order_count,
         total_spent = crm_total_spent,
         last_order_at = crm_last_order_at,
         updated_at = now()
   where id = resolved_customer_id;

  insert into public.crm_activities (customer_id, type, description)
  values (resolved_customer_id, 'order_created', 'Pedido ' || pedido_id || ' creado manualmente/canal ' || normalized_source);

  insert into public.conversion_events (
    event_id, business_unit_id, customer_id, conversation_id, order_id,
    event_name, source_channel, value, currency,
    utm_source, utm_medium, utm_campaign, utm_content, utm_term,
    landing_url, referrer, first_touch_at, last_touch_at
  ) values (
    event_key, p_business_unit_id, resolved_customer_id, null, pedido_id,
    'Purchase', normalized_source, p_total, 'CLP',
    nullif(p_attribution ->> 'utm_source', ''), nullif(p_attribution ->> 'utm_medium', ''),
    nullif(p_attribution ->> 'utm_campaign', ''), nullif(p_attribution ->> 'utm_content', ''),
    nullif(p_attribution ->> 'utm_term', ''), nullif(p_attribution ->> 'landing_url', ''),
    nullif(p_attribution ->> 'referrer', ''), now(), now()
  );

  return jsonb_build_object(
    'pedido_id', pedido_id,
    'customer_id', resolved_customer_id,
    'idempotent_replay', false
  );
end;
$function$;

comment on function public.admin_create_order_v1 is
  'Canonical transactional order creation for admin/manual/imported channel orders.';