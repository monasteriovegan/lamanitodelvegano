create table if not exists public.order_change_log (
  id uuid primary key default gen_random_uuid(),
  pedido_id integer not null references public.pedidos(id) on delete cascade,
  actor text,
  summary text not null,
  before_snapshot jsonb not null,
  after_snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists order_change_log_pedido_created_idx
  on public.order_change_log (pedido_id, created_at desc);

alter table public.order_change_log enable row level security;

comment on table public.order_change_log is
  'Immutable audit trail for material admin changes to canonical orders.';

create or replace function public.admin_update_order_v1(
  p_pedido_id integer,
  p_actor text,
  p_patch jsonb,
  p_order_items jsonb,
  p_stock_items jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  before_snapshot jsonb;
  after_snapshot jsonb;
  business_unit uuid;
  customer uuid;
  old_items jsonb;
  item jsonb;
  product_record record;
  product_id uuid;
  raw_product_id text;
  item_quantity integer;
  item_price numeric(12,2);
  calculated_subtotal numeric(12,2) := 0;
  new_shipping numeric(12,2);
  new_total numeric(12,2);
  new_payment_status text;
  new_source text;
  new_estado text;
  new_customer_name text;
  new_customer_phone text;
  new_customer_email text;
  new_address text;
  new_comuna text;
  new_delivery_date text;
  new_payment_method text;
  new_shipping_zone_name text;
  new_shipping_zone_id uuid;
  new_admin_notes text;
  new_notes text;
  delta integer;
  old_qty integer;
  new_qty integer;
  crm_order_count integer;
  crm_total_spent numeric;
  crm_last_order_at timestamptz;
  change_summary text;
begin
  if p_pedido_id is null or p_pedido_id <= 0 then
    raise exception 'invalid_pedido_id';
  end if;
  if jsonb_typeof(p_order_items) <> 'array' or jsonb_array_length(p_order_items) = 0 then
    raise exception 'empty_admin_order_items';
  end if;
  if jsonb_typeof(p_stock_items) <> 'array' then
    raise exception 'invalid_admin_stock_items';
  end if;

  select to_jsonb(p), p.business_unit_id, p.customer_id, coalesce(p.items, '[]'::jsonb)
    into before_snapshot, business_unit, customer, old_items
    from public.pedidos p
   where p.id = p_pedido_id
   for update;
  if before_snapshot is null then
    raise exception 'pedido_not_found';
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
      select p.id, p.activo into product_record
        from public.productos p
       where p.id = product_id and p.business_unit_id = business_unit;
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

  -- Adjust only the quantity delta between the old and new catalog-backed items.
  for product_record in
    with old_quantities as (
      select (x ->> 'productoId')::uuid as product_id,
             sum(coalesce((x ->> 'qty')::integer, 0))::integer as qty
        from jsonb_array_elements(old_items) x
       where nullif(btrim(coalesce(x ->> 'productoId', '')), '') is not null
       group by (x ->> 'productoId')::uuid
    ),
    new_quantities as (
      select (x ->> 'productoId')::uuid as product_id,
             sum(coalesce((x ->> 'qty')::integer, 0))::integer as qty
        from jsonb_array_elements(p_stock_items) x
       where nullif(btrim(coalesce(x ->> 'productoId', '')), '') is not null
       group by (x ->> 'productoId')::uuid
    )
    select coalesce(o.product_id, n.product_id) as product_id,
           coalesce(o.qty, 0) as old_qty,
           coalesce(n.qty, 0) as new_qty
      from old_quantities o
      full outer join new_quantities n on n.product_id = o.product_id
  loop
    product_id := product_record.product_id;
    old_qty := product_record.old_qty;
    new_qty := product_record.new_qty;
    delta := new_qty - old_qty;

    select p.id, p.activo, p.maneja_stock, p.stock into product_record
      from public.productos p
     where p.id = product_id and p.business_unit_id = business_unit
     for update;
    if not found then raise exception 'product_not_found:%', product_id; end if;

    if delta > 0 then
      if product_record.activo is not true then raise exception 'product_not_available:%', product_id; end if;
      perform public.descontar_stock_v2(product_id, delta);
    elsif delta < 0 and product_record.maneja_stock is true then
      update public.productos
         set stock = coalesce(stock, 0) + abs(delta)
       where id = product_id;
    end if;
  end loop;

  begin
    new_shipping := coalesce(nullif(p_patch ->> 'shipping_cost', '')::numeric, (before_snapshot ->> 'costo_envio')::numeric, 0);
  exception when others then raise exception 'invalid_shipping_cost'; end;
  if new_shipping < 0 then raise exception 'invalid_shipping_cost'; end if;

  new_total := greatest(0, calculated_subtotal + new_shipping - coalesce((before_snapshot ->> 'discount_total')::numeric, 0));
  new_payment_status := lower(btrim(coalesce(nullif(p_patch ->> 'payment_status', ''), before_snapshot ->> 'payment_status', 'pending')));
  if new_payment_status not in ('pending','paid','failed','refunded','partial') then
    raise exception 'invalid_payment_status';
  end if;

  new_source := lower(btrim(coalesce(nullif(p_patch ->> 'source_channel', ''), before_snapshot ->> 'source_channel', 'manual')));
  if new_source not in ('web','whatsapp','instagram','messenger','manual','admin') then
    raise exception 'invalid_source_channel';
  end if;

  new_estado := coalesce(nullif(p_patch ->> 'estado', ''), before_snapshot ->> 'estado', 'Pendiente');
  if lower(new_estado) not in ('pendiente','pagado','despachado','completado','cancelado') then
    raise exception 'invalid_order_status';
  end if;

  new_customer_name := coalesce(nullif(btrim(p_patch ->> 'customer_name'), ''), before_snapshot ->> 'nombre_cliente');
  new_customer_phone := nullif(btrim(coalesce(p_patch ->> 'customer_phone', before_snapshot ->> 'telefono', '')), '');
  new_customer_email := nullif(lower(btrim(coalesce(p_patch ->> 'customer_email', before_snapshot ->> 'customer_email', ''))), '');
  new_address := nullif(btrim(coalesce(p_patch ->> 'address', before_snapshot ->> 'direccion', '')), '');
  new_comuna := nullif(btrim(coalesce(p_patch ->> 'comuna', before_snapshot ->> 'comuna', '')), '');
  new_delivery_date := nullif(btrim(coalesce(p_patch ->> 'delivery_date', before_snapshot ->> 'fecha_entrega', '')), '');
  new_payment_method := nullif(btrim(coalesce(p_patch ->> 'payment_method', before_snapshot ->> 'metodopago', '')), '');
  new_shipping_zone_name := nullif(btrim(coalesce(p_patch ->> 'shipping_zone_name', before_snapshot ->> 'shipping_zone_name', '')), '');
  begin
    new_shipping_zone_id := coalesce(nullif(p_patch ->> 'shipping_zone_id', '')::uuid, nullif(before_snapshot ->> 'shipping_zone_id', '')::uuid);
  exception when others then raise exception 'invalid_shipping_zone_id'; end;
  new_admin_notes := nullif(btrim(coalesce(p_patch ->> 'admin_notes', before_snapshot ->> 'admin_notes', '')), '');
  new_notes := nullif(btrim(coalesce(p_patch ->> 'notes', before_snapshot ->> 'notas', '')), '');

  update public.pedidos
     set nombre_cliente = new_customer_name,
         telefono = new_customer_phone,
         customer_email = new_customer_email,
         direccion = new_address,
         comuna = new_comuna,
         fecha_entrega = new_delivery_date,
         items = p_order_items,
         subtotal = round(calculated_subtotal)::integer,
         total = round(new_total)::integer,
         costo_envio = round(new_shipping)::integer,
         payment_status = new_payment_status,
         metodopago = new_payment_method,
         source_channel = new_source,
         shipping_zone_id = new_shipping_zone_id,
         shipping_zone_name = new_shipping_zone_name,
         admin_notes = new_admin_notes,
         notas = new_notes,
         estado = new_estado,
         updated_at = now()
   where id = p_pedido_id;

  if customer is not null then
    update public.omnichannel_contacts
       set nombre = coalesce(new_customer_name, nombre),
           phone = coalesce(new_customer_phone, phone),
           email = coalesce(new_customer_email, email),
           direccion = coalesce(new_address, direccion),
           metadata = case when new_comuna is not null
             then coalesce(metadata, '{}'::jsonb) || jsonb_build_object('comuna', new_comuna)
             else coalesce(metadata, '{}'::jsonb) end,
           updated_at = now()
     where id = customer;

    select count(*)::integer,
           coalesce(sum(case when p.payment_status = 'paid' then p.total else 0 end), 0),
           max(p.created_at at time zone 'UTC')
      into crm_order_count, crm_total_spent, crm_last_order_at
      from public.pedidos p
     where p.customer_id = customer
       and lower(coalesce(p.estado, '')) <> 'cancelado';

    update public.omnichannel_contacts
       set crm_status = case when crm_order_count > 1 then 'repeat_customer' else 'customer' end,
           total_orders = crm_order_count,
           total_spent = crm_total_spent,
           last_order_at = crm_last_order_at,
           updated_at = now()
     where id = customer;
  end if;

  update public.conversion_events
     set value = new_total,
         source_channel = new_source,
         last_touch_at = now()
   where order_id = p_pedido_id;

  select to_jsonb(p) into after_snapshot
    from public.pedidos p
   where p.id = p_pedido_id;

  change_summary := concat_ws(' · ',
    case when before_snapshot ->> 'estado' is distinct from after_snapshot ->> 'estado'
      then 'Estado: ' || coalesce(before_snapshot ->> 'estado', '—') || ' → ' || coalesce(after_snapshot ->> 'estado', '—') end,
    case when before_snapshot ->> 'payment_status' is distinct from after_snapshot ->> 'payment_status'
      then 'Pago: ' || coalesce(before_snapshot ->> 'payment_status', '—') || ' → ' || coalesce(after_snapshot ->> 'payment_status', '—') end,
    case when before_snapshot ->> 'total' is distinct from after_snapshot ->> 'total'
      then 'Total: $' || coalesce(before_snapshot ->> 'total', '0') || ' → $' || coalesce(after_snapshot ->> 'total', '0') end,
    case when before_snapshot -> 'items' is distinct from after_snapshot -> 'items' then 'Ítems actualizados' end,
    case when before_snapshot ->> 'fecha_entrega' is distinct from after_snapshot ->> 'fecha_entrega' then 'Fecha de entrega actualizada' end,
    case when before_snapshot ->> 'direccion' is distinct from after_snapshot ->> 'direccion' then 'Dirección actualizada' end
  );
  if change_summary is null or btrim(change_summary) = '' then change_summary := 'Pedido actualizado'; end if;

  insert into public.order_change_log (pedido_id, actor, summary, before_snapshot, after_snapshot)
  values (p_pedido_id, nullif(btrim(coalesce(p_actor, '')), ''), change_summary, before_snapshot, after_snapshot);

  return jsonb_build_object('pedido_id', p_pedido_id, 'total', round(new_total)::integer);
end;
$function$;

comment on function public.admin_update_order_v1 is
  'Transactional full admin edit with stock deltas, CRM recomputation and immutable audit log.';