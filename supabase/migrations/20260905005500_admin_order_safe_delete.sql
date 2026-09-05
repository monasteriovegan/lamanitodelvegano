-- Eliminación administrativa segura de pedidos no pagados/no finalizados.
-- Mantiene inventario y CRM consistentes y evita borrar trazabilidad financiera real.

create or replace function public.admin_delete_order_v1(
  p_pedido_id integer,
  p_actor text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  order_row public.pedidos%rowtype;
  stock_row record;
  customer uuid;
  crm_order_count integer;
  crm_total_spent numeric;
  crm_last_order_at timestamptz;
  stock_units_restored integer := 0;
  affected integer := 0;
begin
  if p_pedido_id is null or p_pedido_id <= 0 then
    raise exception 'invalid_pedido_id';
  end if;

  select p.*
    into order_row
    from public.pedidos p
   where p.id = p_pedido_id
   for update;

  if not found then
    raise exception 'pedido_not_found';
  end if;

  -- Una venta con dinero confirmado o historial de devolución no se destruye.
  -- Debe cancelarse/reembolsarse conservando trazabilidad.
  if lower(coalesce(order_row.payment_status, '')) in ('paid', 'partial', 'refunded') then
    raise exception 'order_delete_protected_payment:%', order_row.payment_status;
  end if;

  if lower(coalesce(order_row.payment_status, '')) not in ('pending', 'failed') then
    raise exception 'order_delete_protected_payment:%', coalesce(order_row.payment_status, 'unknown');
  end if;

  if lower(coalesce(order_row.estado, '')) in ('pagado', 'despachado', 'completado') then
    raise exception 'order_delete_protected_status:%', order_row.estado;
  end if;

  customer := order_row.customer_id;

  -- Los flujos canónicos descuentan stock al crear el pedido. Reponemos únicamente
  -- productos reales que manejan stock; los ítems personalizados/off-catalog se ignoran.
  for stock_row in
    select parsed.product_id, sum(parsed.qty)::integer as qty
      from (
        select raw_id::uuid as product_id,
               case
                 when raw_qty ~ '^[0-9]+$' then raw_qty::integer
                 else 0
               end as qty
          from (
            select coalesce(
                     nullif(btrim(item ->> 'productoId'), ''),
                     nullif(btrim(item ->> 'producto_id'), '')
                   ) as raw_id,
                   coalesce(
                     nullif(btrim(item ->> 'qty'), ''),
                     nullif(btrim(item ->> 'quantity'), ''),
                     '0'
                   ) as raw_qty
              from jsonb_array_elements(coalesce(order_row.items, '[]'::jsonb)) item
          ) source_items
         where raw_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      ) parsed
     where parsed.qty > 0
     group by parsed.product_id
  loop
    update public.productos
       set stock = coalesce(stock, 0) + stock_row.qty
     where id = stock_row.product_id
       and business_unit_id = order_row.business_unit_id
       and maneja_stock is true;

    get diagnostics affected = row_count;
    if affected > 0 then
      stock_units_restored := stock_units_restored + stock_row.qty;
    end if;
  end loop;

  -- Un pedido eliminado por decisión administrativa no debe dejar eventos de
  -- conversión huérfanos que luego parezcan una compra real.
  delete from public.conversion_events
   where order_id = p_pedido_id;

  -- Las FK existentes limpian conversation_orders/order history por CASCADE y
  -- sueltan conversations/messages/cart/payment queue por SET NULL.
  delete from public.pedidos
   where id = p_pedido_id;

  if customer is not null then
    select count(*)::integer,
           coalesce(sum(case when p.payment_status = 'paid' then p.total else 0 end), 0),
           max(p.created_at)
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

    insert into public.crm_activities (customer_id, type, description, metadata)
    values (
      customer,
      'order_deleted',
      'Pedido ' || p_pedido_id || ' eliminado desde panel administrativo',
      jsonb_build_object('order_id', p_pedido_id, 'actor', nullif(btrim(coalesce(p_actor, '')), ''))
    );
  end if;

  return jsonb_build_object(
    'pedido_id', p_pedido_id,
    'deleted', true,
    'stock_units_restored', stock_units_restored
  );
end;
$function$;

revoke all on function public.admin_delete_order_v1(integer, text) from public;
revoke all on function public.admin_delete_order_v1(integer, text) from anon;
revoke all on function public.admin_delete_order_v1(integer, text) from authenticated;
grant execute on function public.admin_delete_order_v1(integer, text) to service_role;
