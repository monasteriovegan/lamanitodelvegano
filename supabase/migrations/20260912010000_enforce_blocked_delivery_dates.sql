create or replace function public.enforce_unblocked_delivery_date()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.fecha_entrega is not null
     and new.business_unit_id is not null
     and exists (
       select 1
       from public.blocked_delivery_dates blocked
       where blocked.business_unit_id = new.business_unit_id
         and blocked.date::text = btrim(new.fecha_entrega)
     ) then
    raise exception 'delivery_date_blocked:%', new.fecha_entrega using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists pedidos_enforce_unblocked_delivery_date on public.pedidos;
create trigger pedidos_enforce_unblocked_delivery_date
before insert or update of fecha_entrega, business_unit_id on public.pedidos
for each row
execute function public.enforce_unblocked_delivery_date();
