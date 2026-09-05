begin;

-- Persist Remy's commercial stage from server-side facts. The LLM never owns
-- this state; cart/order/payment writes advance it automatically.
create or replace function public.remy_set_cart_commerce_stage()
returns trigger
language plpgsql
as $$
declare
  meta jsonb := coalesce(new.metadata, '{}'::jsonb);
  item_count integer := 0;
  stage text;
  existing_stage text := btrim(coalesce(meta->>'commerce_stage', ''));
  existing_stage_rank integer := -1;
  derived_stage_rank integer := -1;
  delivery_started boolean;
  delivery_complete boolean;
  customer_complete boolean;
  payment_method text;
  phone_value text;
begin
  if jsonb_typeof(coalesce(to_jsonb(new.items), '[]'::jsonb)) = 'array' then
    item_count := jsonb_array_length(coalesce(to_jsonb(new.items), '[]'::jsonb));
  end if;

  payment_method := lower(btrim(coalesce(meta->>'paymentMethod', '')));
  phone_value := btrim(coalesce(meta->>'phone', new.telefono, ''));

  if new.order_id is not null then
    stage := 'confirmed';
  elsif item_count = 0 then
    stage := 'discover';
  else
    delivery_started :=
      btrim(coalesce(meta->>'comuna', '')) <> '' or
      btrim(coalesce(meta->>'zonaId', '')) <> '' or
      btrim(coalesce(meta->>'deliveryDate', '')) <> '' or
      btrim(coalesce(meta->>'direccion', '')) <> '';

    delivery_complete :=
      btrim(coalesce(meta->>'direccion', '')) <> '' and
      btrim(coalesce(meta->>'comuna', '')) <> '' and
      btrim(coalesce(meta->>'zonaId', '')) <> '' and
      btrim(coalesce(meta->>'deliveryDate', '')) <> '';

    customer_complete :=
      btrim(coalesce(meta->>'nombre', '')) <> '' and
      phone_value <> '' and
      payment_method <> '' and
      (payment_method <> 'flow' or btrim(coalesce(meta->>'email', '')) <> '');

    if not delivery_started then
      stage := 'cart';
    elsif not delivery_complete then
      stage := 'delivery';
    elsif not customer_complete then
      stage := 'details';
    else
      stage := 'review';
    end if;
  end if;

  -- A cart can legitimately move backwards before an order exists (for example
  -- when the customer clears it). Once an order exists, however, later facts
  -- written by the order trigger (payment/post_sale) must never be overwritten
  -- by this cart trigger merely because metadata was touched again.
  existing_stage_rank := case existing_stage
    when 'discover' then 0
    when 'cart' then 1
    when 'delivery' then 2
    when 'details' then 3
    when 'review' then 4
    when 'confirmed' then 5
    when 'payment' then 6
    when 'post_sale' then 7
    else -1
  end;
  derived_stage_rank := case stage
    when 'discover' then 0
    when 'cart' then 1
    when 'delivery' then 2
    when 'details' then 3
    when 'review' then 4
    when 'confirmed' then 5
    when 'payment' then 6
    when 'post_sale' then 7
    else -1
  end;

  if new.order_id is not null and existing_stage_rank > derived_stage_rank then
    stage := existing_stage;
  end if;

  if coalesce(meta->>'commerce_stage', '') is distinct from stage then
    new.metadata := meta || jsonb_build_object(
      'commerce_stage', stage,
      'commerce_stage_updated_at', now()
    );
  else
    new.metadata := meta;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_remy_cart_commerce_stage on public.carritos_abandonados;
create trigger trg_remy_cart_commerce_stage
before insert or update of items, metadata, order_id, telefono
on public.carritos_abandonados
for each row
execute function public.remy_set_cart_commerce_stage();

create or replace function public.remy_sync_order_commerce_stage()
returns trigger
language plpgsql
as $$
declare
  stage text;
begin
  if lower(coalesce(new.payment_status, '')) in ('paid', 'approved', 'completed', 'refunded', 'cancelled', 'canceled') then
    stage := 'post_sale';
  elsif btrim(coalesce(new.external_token, '')) <> '' then
    stage := 'payment';
  else
    stage := 'confirmed';
  end if;

  update public.carritos_abandonados
     set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
       'commerce_stage', stage,
       'commerce_stage_updated_at', now(),
       'commerce_order_id', new.id,
       'commerce_payment_status', new.payment_status
     )
   where order_id = new.id
     and coalesce(metadata->>'commerce_stage', '') is distinct from stage;

  return new;
end;
$$;

drop trigger if exists trg_remy_order_commerce_stage on public.pedidos;
create trigger trg_remy_order_commerce_stage
after insert or update of external_token, payment_status
on public.pedidos
for each row
execute function public.remy_sync_order_commerce_stage();

-- Backfill existing carts/orders through the same deterministic functions.
update public.carritos_abandonados
   set metadata = coalesce(metadata, '{}'::jsonb);

update public.pedidos
   set payment_status = payment_status
 where id in (
   select distinct order_id
     from public.carritos_abandonados
    where order_id is not null
 );

commit;
