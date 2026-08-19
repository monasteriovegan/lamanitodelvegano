-- Endurece el tracking público: los códigos no deben ser secuenciales ni adivinables.
-- El índice único creado en la migración anterior sigue siendo la garantía final
-- contra duplicados; el loop evita colisiones antes de llegar al índice.

update public.pedidos
set tracking_number = 'LMV-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))
where tracking_number is null
   or btrim(tracking_number) = ''
   or tracking_number ~ '^LMV-[0-9]{6}$';

create or replace function public.ensure_pedido_tracking_number()
returns trigger
language plpgsql
as $$
declare
  candidate text;
begin
  if new.tracking_number is null or btrim(new.tracking_number) = '' then
    loop
      candidate := 'LMV-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
      exit when not exists (
        select 1 from public.pedidos where tracking_number = candidate
      );
    end loop;
    new.tracking_number := candidate;
  end if;
  return new;
end;
$$;
