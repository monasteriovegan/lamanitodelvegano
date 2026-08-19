-- Tracking interno automático para todos los pedidos.
-- Se deriva del PK integer del pedido, por lo que es estable y no se repite.

update public.pedidos
set tracking_number = 'LMV-' || lpad(id::text, 6, '0')
where tracking_number is null or btrim(tracking_number) = '';

create unique index if not exists pedidos_tracking_number_unique_idx
  on public.pedidos (tracking_number)
  where tracking_number is not null and btrim(tracking_number) <> '';

create or replace function public.ensure_pedido_tracking_number()
returns trigger
language plpgsql
as $$
begin
  if new.tracking_number is null or btrim(new.tracking_number) = '' then
    new.tracking_number := 'LMV-' || lpad(new.id::text, 6, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists pedidos_tracking_number_auto on public.pedidos;
create trigger pedidos_tracking_number_auto
before insert or update of tracking_number on public.pedidos
for each row
execute function public.ensure_pedido_tracking_number();
