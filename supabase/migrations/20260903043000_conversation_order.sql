create or replace function public.conversation_create_order_v1(
  p_idempotency_key text,
  p_business_unit_id uuid,
  p_customer_id uuid,
  p_conversation_id uuid,
  p_customer_email text,
  p_customer_name text,
  p_customer_phone text,
  p_address text,
  p_comuna text,
  p_order_items jsonb,
  p_stock_items jsonb,
  p_total numeric,
  p_payment_method text,
  p_payment_confirmed boolean,
  p_shipping_cost numeric,
  p_shipping_zone_id uuid,
  p_shipping_zone_name text,
  p_delivery_date text,
  p_source_channel text,
  p_admin_notes text,
  p_attribution jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  item jsonb;
  product_record record;
  product_id uuid;
  item_quantity integer;
  item_price numeric(12,2);
  calculated_subtotal numeric(12,2) := 0;
  pedido_id integer;
  existing_order_id integer;
  token_hash text;
  event_key text;
  normalized_phone text;
  normalized_email text;
begin
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'missing_idempotency_key';
  end if;
  if p_customer_name is null or btrim(p_customer_name) = '' then
    raise exception 'missing_customer_name';
  end if;
  if p_conversation_id is null then
    raise exception 'missing_conversation_id';
  end if;
  if jsonb_typeof(p_stock_items) <> 'array' or jsonb_array_length(p_stock_items) = 0 then
    raise exception 'empty_conversation_order_items';
  end if;
  if jsonb_typeof(p_order_items) <> 'array' then
    raise exception 'invalid_conversation_order_items';
  end if;
  if coalesce(p_shipping_cost, 0) < 0 or coalesce(p_total, 0) < 0 then
    raise exception 'invalid_conversation_order_total';
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
  if not exists (
    select 1 from public.conversations c
     where c.id = p_conversation_id
       and c.business_unit_id = p_business_unit_id
       and (c.customer_id = p_customer_id or c.contact_id = p_customer_id::text)
  ) then
    raise exception 'conversation_customer_mismatch';
  end if;

  token_hash := encode(extensions.digest(p_idempotency_key, 'sha256'), 'hex');
  event_key := 'conversation_order:' || token_hash;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(event_key, 0));

  select ce.order_id
    into existing_order_id
    from public.conversion_events ce
   where ce.business_unit_id = p_business_unit_id
     and ce.event_id = event_key
   limit 1;
  if found and existing_order_id is not null then
    return jsonb_build_object('pedido_id', existing_order_id, 'idempotent_replay', true);
  end if;

  for item in select value from jsonb_array_elements(p_stock_items)
  loop
    begin
      product_id := (item ->> 'productoId')::uuid;
      item_quantity := (item ->> 'qty')::integer;
      item_price := (item ->> 'precio')::numeric;
    exception when others then
      raise exception 'invalid_conversation_order_item';
    end;

    if item_quantity <= 0 or item_price < 0 then
      raise exception 'invalid_conversation_order_item_values:%', product_id;
    end if;

    select p.id, p.nombre, p.activo
      into product_record
      from public.productos p
     where p.id = product_id
       and p.business_unit_id = p_business_unit_id
     for update;
    if not found or product_record.activo is not true then
      raise exception 'product_not_available:%', product_id;
    end if;

    perform public.descontar_stock_v2(product_id, item_quantity);
    calculated_subtotal := calculated_subtotal + (item_price * item_quantity);
  end loop;

  if round(p_total, 2) <> round(calculated_subtotal + coalesce(p_shipping_cost, 0), 2) then
    raise exception 'conversation_order_total_mismatch';
  end if;

  normalized_phone := nullif(btrim(coalesce(p_customer_phone, '')), '');
  normalized_email := nullif(lower(btrim(coalesce(p_customer_email, ''))), '');

  insert into public.pedidos (
    business_unit_id, customer_id, customer_email, source_channel, currency,
    payment_status, discount_total, loyalty_discount,
    loyalty_points_redeemed, loyalty_points_earned,
    shipping_zone_id, shipping_zone_name, nombre_cliente, telefono,
    direccion, comuna, fecha_entrega, items, subtotal, total, estado,
    metodopago, costo_envio, admin_notes
  ) values (
    p_business_unit_id, p_customer_id, normalized_email,
    coalesce(nullif(btrim(p_source_channel), ''), 'conversation'), 'CLP',
    case when p_payment_confirmed then 'paid' else 'pending' end,
    0, 0, 0, 0,
    p_shipping_zone_id, p_shipping_zone_name, p_customer_name, normalized_phone,
    p_address, p_comuna, p_delivery_date, p_order_items,
    round(calculated_subtotal)::integer, round(p_total)::integer,
    case when p_payment_confirmed then 'Pagado' else 'Pendiente' end,
    p_payment_method, round(coalesce(p_shipping_cost, 0))::integer,
    nullif(btrim(coalesce(p_admin_notes, '')), '')
  ) returning id into pedido_id;

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
         crm_status = 'customer',
         total_orders = coalesce(total_orders, 0) + 1,
         total_spent = coalesce(total_spent, 0) + p_total,
         last_order_at = now(),
         updated_at = now()
   where id = p_customer_id;

  if nullif(btrim(p_customer_phone), '') is not null then
    insert into public.customer_identities (
      business_unit_id, customer_id, provider, identity_type,
      external_id, normalized_value, verified
    ) values (
      p_business_unit_id, p_customer_id, 'manual', 'phone',
      btrim(p_customer_phone), btrim(p_customer_phone), false
    ) on conflict (business_unit_id, provider, external_id)
      do update set customer_id = excluded.customer_id,
                    normalized_value = excluded.normalized_value,
                    updated_at = now();
  end if;

  if normalized_email is not null then
    insert into public.customer_identities (
      business_unit_id, customer_id, provider, identity_type,
      external_id, normalized_value, verified
    ) values (
      p_business_unit_id, p_customer_id, 'manual', 'email',
      normalized_email, normalized_email, false
    ) on conflict (business_unit_id, provider, external_id)
      do update set customer_id = excluded.customer_id,
                    normalized_value = excluded.normalized_value,
                    updated_at = now();
  end if;

  insert into public.crm_activities (customer_id, type, description)
  values (p_customer_id, 'order_created', 'Pedido ' || pedido_id || ' creado desde conversación');

  insert into public.conversion_events (
    event_id, business_unit_id, customer_id, conversation_id, order_id,
    event_name, source_channel, value, currency,
    utm_source, utm_medium, utm_campaign, utm_content, utm_term,
    landing_url, referrer, first_touch_at, last_touch_at
  ) values (
    event_key, p_business_unit_id, p_customer_id, p_conversation_id, pedido_id,
    'Purchase', coalesce(nullif(btrim(p_source_channel), ''), 'conversation'), p_total, 'CLP',
    nullif(p_attribution ->> 'utm_source', ''), nullif(p_attribution ->> 'utm_medium', ''),
    nullif(p_attribution ->> 'utm_campaign', ''), nullif(p_attribution ->> 'utm_content', ''),
    nullif(p_attribution ->> 'utm_term', ''), nullif(p_attribution ->> 'landing_url', ''),
    nullif(p_attribution ->> 'referrer', ''), now(), now()
  );

  return jsonb_build_object('pedido_id', pedido_id, 'idempotent_replay', false);
end;
$$;
