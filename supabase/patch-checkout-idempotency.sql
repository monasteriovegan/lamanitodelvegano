create or replace function public.checkout_create_order_v2(
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
  token_hash text;
begin
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    raise exception 'missing_idempotency_key';
  end if;
  token_hash := encode(extensions.digest(p_idempotency_key, 'sha256'), 'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(token_hash, 0));

  select c.id, ce.order_id
    into cart_id, pedido_id
    from public.carts c
    join public.conversion_events ce on ce.cart_id = c.id
   where c.business_unit_id = p_business_unit_id
     and c.checkout_token_hash = token_hash
   limit 1;
  if found then
    return jsonb_build_object('pedido_id', pedido_id, 'cart_id', cart_id, 'idempotent_replay', true);
  end if;

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
    subtotal, discount_total, shipping_total, total, checkout_token_hash
  ) values (
    p_business_unit_id, p_customer_id, 'checkout', 'web', 'CLP',
    0, coalesce(p_discount_total, 0), coalesce(p_shipping_cost, 0), p_total, token_hash
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
    'checkout:' || token_hash, p_business_unit_id, p_customer_id, cart_id, pedido_id,
    'Purchase', 'web', p_total, 'CLP',
    nullif(p_attribution ->> 'fbclid', ''), nullif(p_attribution ->> 'fbc', ''),
    nullif(p_attribution ->> 'fbp', ''), nullif(p_attribution ->> 'gclid', ''),
    nullif(p_attribution ->> 'gbraid', ''), nullif(p_attribution ->> 'wbraid', ''),
    nullif(p_attribution ->> 'utm_source', ''), nullif(p_attribution ->> 'utm_medium', ''),
    nullif(p_attribution ->> 'utm_campaign', ''), nullif(p_attribution ->> 'utm_content', ''),
    nullif(p_attribution ->> 'utm_term', ''), nullif(p_attribution ->> 'landing_url', ''),
    nullif(p_attribution ->> 'referrer', ''), now(), now()
  );

  return jsonb_build_object('pedido_id', pedido_id, 'cart_id', cart_id, 'idempotent_replay', false);
end
$function$;

revoke all on function public.checkout_create_order_v2(
  text, uuid, uuid, text, text, text, text, text, jsonb, jsonb, numeric, text,
  numeric, uuid, text, numeric, numeric, integer, jsonb
) from public, anon, authenticated;
grant execute on function public.checkout_create_order_v2(
  text, uuid, uuid, text, text, text, text, text, jsonb, jsonb, numeric, text,
  numeric, uuid, text, numeric, numeric, integer, jsonb
) to service_role;
