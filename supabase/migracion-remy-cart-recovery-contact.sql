create or replace function public.remy_cart_sync_recovery_contact()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.nombre := coalesce(nullif(btrim(new.nombre), ''), nullif(btrim(new.metadata->>'nombre'), ''));
  new.email := coalesce(nullif(btrim(new.email), ''), nullif(btrim(new.metadata->>'email'), ''));
  new.telefono := coalesce(nullif(btrim(new.telefono), ''), nullif(btrim(new.metadata->>'phone'), ''));
  return new;
end;
$$;

drop trigger if exists trg_remy_cart_sync_recovery_contact on public.carritos_abandonados;
create trigger trg_remy_cart_sync_recovery_contact
before insert or update of metadata on public.carritos_abandonados
for each row execute function public.remy_cart_sync_recovery_contact();
