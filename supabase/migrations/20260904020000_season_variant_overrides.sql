create table if not exists public.season_variant_overrides (
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid not null references public.business_units(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  price_override integer check (price_override is null or price_override >= 0),
  compare_at_price_override integer check (compare_at_price_override is null or compare_at_price_override >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, variant_id)
);

create index if not exists season_variant_overrides_business_season_idx
  on public.season_variant_overrides (business_unit_id, season_id);

create or replace function public.validate_season_variant_override()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  season_business uuid;
  variant_business uuid;
  master_price integer;
begin
  select business_unit_id into season_business
  from public.seasons
  where id = new.season_id;

  select business_unit_id, price into variant_business, master_price
  from public.product_variants
  where id = new.variant_id;

  if season_business is null or variant_business is null then
    raise exception 'season_or_variant_not_found';
  end if;

  if new.business_unit_id <> season_business or new.business_unit_id <> variant_business then
    raise exception 'season_variant_business_mismatch';
  end if;

  if new.compare_at_price_override is not null
     and new.compare_at_price_override < coalesce(new.price_override, master_price) then
    raise exception 'compare_at_price_below_effective_price';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_validate_season_variant_override on public.season_variant_overrides;
create trigger trg_validate_season_variant_override
before insert or update on public.season_variant_overrides
for each row execute function public.validate_season_variant_override();

alter table public.season_variant_overrides enable row level security;

grant select on public.season_variant_overrides to anon, authenticated;
grant all on public.season_variant_overrides to service_role;

create policy season_variant_overrides_public_read
  on public.season_variant_overrides for select to anon, authenticated
  using (
    is_active
    and exists (
      select 1
      from public.seasons s
      join public.product_variants v on v.id = season_variant_overrides.variant_id
      join public.season_products sp on sp.season_id = s.id and sp.product_id = v.product_id
      where s.id = season_variant_overrides.season_id
        and s.business_unit_id = season_variant_overrides.business_unit_id
        and v.business_unit_id = season_variant_overrides.business_unit_id
        and s.is_active is true
    )
  );

create policy season_variant_overrides_admin_insert
  on public.season_variant_overrides for insert to authenticated
  with check ((select public.is_admin()));
create policy season_variant_overrides_admin_update
  on public.season_variant_overrides for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy season_variant_overrides_admin_delete
  on public.season_variant_overrides for delete to authenticated
  using ((select public.is_admin()));
