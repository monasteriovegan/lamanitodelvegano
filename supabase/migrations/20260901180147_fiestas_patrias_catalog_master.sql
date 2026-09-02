alter table public.seasons
  add column if not exists campaign_tag text,
  add column if not exists visible_web boolean not null default true,
  add column if not exists visible_whatsapp boolean not null default true,
  add column if not exists visible_instagram boolean not null default true,
  add column if not exists available_to_remy boolean not null default true;

alter table public.season_products
  add column if not exists visible_web boolean not null default true,
  add column if not exists visible_whatsapp boolean not null default true,
  add column if not exists visible_instagram boolean not null default true,
  add column if not exists available_to_remy boolean not null default true,
  add column if not exists is_featured boolean not null default false,
  add column if not exists sort_order integer not null default 0;

create unique index if not exists seasons_business_unit_campaign_tag_key
  on public.seasons (business_unit_id, campaign_tag)
  where campaign_tag is not null;

create index if not exists season_products_season_sort_idx
  on public.season_products (season_id, sort_order);

create unique index if not exists productos_id_business_unit_key
  on public.productos (id, business_unit_id);

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid not null references public.business_units(id) on delete cascade,
  product_id uuid not null,
  sku text not null,
  name text not null,
  price integer not null check (price >= 0),
  compare_at_price integer check (compare_at_price is null or compare_at_price >= price),
  weight_grams integer check (weight_grams is null or weight_grams > 0),
  units_included integer not null default 1 check (units_included > 0),
  selection_quantity integer not null default 0 check (selection_quantity >= 0),
  manages_stock boolean not null default false,
  stock integer check (stock is null or stock >= 0),
  capacity integer check (capacity is null or capacity >= 0),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  image_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_unit_id, sku),
  unique (product_id, name),
  foreign key (product_id, business_unit_id)
    references public.productos(id, business_unit_id) on delete cascade
);

create index if not exists product_variants_business_product_idx
  on public.product_variants (business_unit_id, product_id, sort_order);

create table if not exists public.product_option_groups (
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid not null references public.business_units(id) on delete cascade,
  product_id uuid not null,
  code text not null,
  name text not null,
  selection_mode text not null check (selection_mode in ('single', 'quantity')),
  is_required boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, code),
  unique (id, business_unit_id),
  foreign key (product_id, business_unit_id)
    references public.productos(id, business_unit_id) on delete cascade
);

create index if not exists product_option_groups_business_product_idx
  on public.product_option_groups (business_unit_id, product_id, sort_order);

create table if not exists public.product_option_values (
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid not null references public.business_units(id) on delete cascade,
  option_group_id uuid not null,
  code text not null,
  label text not null,
  price_delta integer not null default 0,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (option_group_id, code),
  foreign key (option_group_id, business_unit_id)
    references public.product_option_groups(id, business_unit_id) on delete cascade
);

create index if not exists product_option_values_business_group_idx
  on public.product_option_values (business_unit_id, option_group_id, sort_order);

create table if not exists public.product_pack_components (
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid not null references public.business_units(id) on delete cascade,
  pack_product_id uuid not null,
  component_product_id uuid,
  component_name text not null,
  quantity numeric not null check (quantity > 0),
  unit text not null,
  weight_grams integer check (weight_grams is null or weight_grams > 0),
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (pack_product_id, business_unit_id)
    references public.productos(id, business_unit_id) on delete cascade,
  foreign key (component_product_id, business_unit_id)
    references public.productos(id, business_unit_id) on delete set null (component_product_id)
);

create index if not exists product_pack_components_business_pack_idx
  on public.product_pack_components (business_unit_id, pack_product_id, sort_order);

create index if not exists product_pack_components_component_idx
  on public.product_pack_components (component_product_id)
  where component_product_id is not null;

alter table public.product_variants enable row level security;
alter table public.product_option_groups enable row level security;
alter table public.product_option_values enable row level security;
alter table public.product_pack_components enable row level security;

grant select on public.product_variants to anon, authenticated;
grant select on public.product_option_groups to anon, authenticated;
grant select on public.product_option_values to anon, authenticated;
grant select on public.product_pack_components to anon, authenticated;
grant all on public.product_variants to service_role;
grant all on public.product_option_groups to service_role;
grant all on public.product_option_values to service_role;
grant all on public.product_pack_components to service_role;

create policy catalog_variants_public_read
  on public.product_variants for select to anon, authenticated
  using (
    is_active
    and exists (
      select 1 from public.productos p
      where p.id = product_variants.product_id
        and p.business_unit_id = product_variants.business_unit_id
        and p.activo is true
    )
  );

create policy catalog_option_groups_public_read
  on public.product_option_groups for select to anon, authenticated
  using (
    is_active
    and exists (
      select 1 from public.productos p
      where p.id = product_option_groups.product_id
        and p.business_unit_id = product_option_groups.business_unit_id
        and p.activo is true
    )
  );

create policy catalog_option_values_public_read
  on public.product_option_values for select to anon, authenticated
  using (
    is_active
    and exists (
      select 1
      from public.product_option_groups g
      join public.productos p on p.id = g.product_id
      where g.id = product_option_values.option_group_id
        and g.business_unit_id = product_option_values.business_unit_id
        and g.is_active
        and p.business_unit_id = product_option_values.business_unit_id
        and p.activo is true
    )
  );

create policy catalog_pack_components_public_read
  on public.product_pack_components for select to anon, authenticated
  using (
    exists (
      select 1 from public.productos p
      where p.id = product_pack_components.pack_product_id
        and p.business_unit_id = product_pack_components.business_unit_id
        and p.activo is true
    )
  );

create policy catalog_variants_admin_insert
  on public.product_variants for insert to authenticated
  with check ((select public.is_admin()));
create policy catalog_variants_admin_update
  on public.product_variants for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy catalog_variants_admin_delete
  on public.product_variants for delete to authenticated
  using ((select public.is_admin()));

create policy catalog_option_groups_admin_insert
  on public.product_option_groups for insert to authenticated
  with check ((select public.is_admin()));
create policy catalog_option_groups_admin_update
  on public.product_option_groups for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy catalog_option_groups_admin_delete
  on public.product_option_groups for delete to authenticated
  using ((select public.is_admin()));

create policy catalog_option_values_admin_insert
  on public.product_option_values for insert to authenticated
  with check ((select public.is_admin()));
create policy catalog_option_values_admin_update
  on public.product_option_values for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy catalog_option_values_admin_delete
  on public.product_option_values for delete to authenticated
  using ((select public.is_admin()));

create policy catalog_pack_components_admin_insert
  on public.product_pack_components for insert to authenticated
  with check ((select public.is_admin()));
create policy catalog_pack_components_admin_update
  on public.product_pack_components for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy catalog_pack_components_admin_delete
  on public.product_pack_components for delete to authenticated
  using ((select public.is_admin()));
