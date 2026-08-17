-- Fase 1 de aislamiento multinegocio para productos.
-- Aditiva y compatible: agrega business_unit_id nullable, backfill a La Manito,
-- FK e índice. La columna se endurece a NOT NULL solo después de adaptar y validar
-- todos los paths de escritura.

begin;

alter table public.productos
  add column if not exists business_unit_id uuid;

do $block$
declare
  v_business_id uuid;
begin
  select id into v_business_id
  from public.business_units
  where slug = 'la-manito-del-vegano'
  limit 1;

  if v_business_id is null then
    raise exception 'missing_business_unit:la-manito-del-vegano';
  end if;

  update public.productos
  set business_unit_id = v_business_id
  where business_unit_id is null;
end
$block$;

do $block$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'productos_business_unit_id_fkey'
      and conrelid = 'public.productos'::regclass
  ) then
    alter table public.productos
      add constraint productos_business_unit_id_fkey
      foreign key (business_unit_id)
      references public.business_units(id)
      on delete restrict;
  end if;
end
$block$;

create index if not exists productos_business_unit_id_idx
  on public.productos (business_unit_id);

commit;
