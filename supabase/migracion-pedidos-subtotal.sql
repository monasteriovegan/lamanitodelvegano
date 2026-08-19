-- Mantiene pedidos.subtotal coherente con los items cuando el flujo legacy/transaccional
-- no lo escribe explícitamente. No modifica total, descuentos, despacho ni stock.

create or replace function public.fill_pedido_subtotal()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.subtotal is null and jsonb_typeof(new.items) = 'array' then
    select coalesce(sum(
      coalesce(nullif(item ->> 'precio', '')::numeric, 0)
      * coalesce(nullif(item ->> 'qty', '')::numeric, 1)
    ), 0)
    into new.subtotal
    from jsonb_array_elements(new.items) as item;
  end if;
  return new;
end;
$$;

drop trigger if exists pedidos_fill_subtotal on public.pedidos;
create trigger pedidos_fill_subtotal
before insert or update of items, subtotal on public.pedidos
for each row
execute function public.fill_pedido_subtotal();

update public.pedidos p
set subtotal = (
  select coalesce(sum(
    coalesce(nullif(item ->> 'precio', '')::numeric, 0)
    * coalesce(nullif(item ->> 'qty', '')::numeric, 1)
  ), 0)
  from jsonb_array_elements(p.items) as item
)
where p.subtotal is null
  and jsonb_typeof(p.items) = 'array';
