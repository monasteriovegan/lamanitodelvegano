-- Keep Cyber campaign artwork and grouped offers separate from the master catalog.
-- This migration is intentionally idempotent and never updates master images or prices.
begin;

alter table public.season_products
  add column if not exists campaign_name text,
  add column if not exists campaign_description text,
  add column if not exists campaign_image_url text,
  add column if not exists campaign_alt_text text,
  add column if not exists presentation_slot text not null default 'catalog';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.season_products'::regclass
      and conname = 'season_products_presentation_slot_check'
  ) then
    alter table public.season_products
      add constraint season_products_presentation_slot_check
      check (presentation_slot in ('hero_offer', 'featured', 'catalog', 'target_only'));
  end if;
end $$;

create unique index if not exists seasons_id_business_unit_key
  on public.seasons (id, business_unit_id);
create unique index if not exists product_variants_id_product_business_key
  on public.product_variants (id, product_id, business_unit_id);

create table if not exists public.season_product_variant_targets (
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid not null references public.business_units(id) on delete cascade,
  season_id uuid not null,
  display_product_id uuid not null,
  target_product_id uuid not null,
  target_variant_id uuid not null,
  group_label text not null check (length(trim(group_label)) > 0),
  option_label text not null check (length(trim(option_label)) > 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, display_product_id, target_variant_id),
  foreign key (season_id, business_unit_id)
    references public.seasons(id, business_unit_id) on delete cascade,
  foreign key (display_product_id, business_unit_id)
    references public.productos(id, business_unit_id) on delete cascade,
  foreign key (target_product_id, business_unit_id)
    references public.productos(id, business_unit_id) on delete cascade,
  foreign key (target_variant_id, target_product_id, business_unit_id)
    references public.product_variants(id, product_id, business_unit_id) on delete cascade
);

create index if not exists season_product_variant_targets_lookup_idx
  on public.season_product_variant_targets (season_id, display_product_id, sort_order);

alter table public.season_product_variant_targets enable row level security;
revoke all on public.season_product_variant_targets from public, anon, authenticated;
grant all on public.season_product_variant_targets to service_role;
drop policy if exists season_product_variant_targets_service_all
  on public.season_product_variant_targets;
create policy season_product_variant_targets_service_all
  on public.season_product_variant_targets for all to service_role
  using (true) with check (true);

do $$
declare
  b uuid := 'f3b57ce7-0796-40e5-94f1-07cb2b48ba85';
  v_season_id uuid;
  v_bombon_group_id uuid;
begin
  select id into v_season_id
  from public.seasons
  where business_unit_id = b
    and campaign_tag = 'cyber-day-chocolatoso-2026';

  if v_season_id is null then
    raise exception 'Temporada Cyber no existe; abortar antes de aplicar presentación';
  end if;

  if (
    select count(*) from public.productos
    where business_unit_id = b and slug in (
      'duo-barras-rellenas', 'barra-dubai', 'barra-terremoto',
      'explosion-supernova', 'protein-balls', 'brigadeiros-trufas-surtidos',
      'promocion-24-bombones', 'alfajores-canamo', 'box-chocolatosa'
    )
  ) <> 9 then
    raise exception 'Productos de presentación Cyber incompletos; abortar';
  end if;

  if (
    select count(*) from public.product_variants
    where business_unit_id = b and is_active and sku in (
      'LMV-DUBAI-120G', 'LMV-DUBAI-240G',
      'LMV-TERREMOTO-120G', 'LMV-TERREMOTO-240G',
      'LMV-SUPERNOVA-110', 'LMV-SUPERNOVA-230'
    )
  ) <> 6 then
    raise exception 'Variantes de barras Cyber incompletas; abortar';
  end if;

  update public.seasons
  set banner_image = '/campaigns/cyber-day-chocolatoso-2026/hero-duo-barras.webp',
      updated_at = now()
  where id = v_season_id;

  update public.season_products
  set campaign_name = null,
      campaign_description = null,
      campaign_image_url = null,
      campaign_alt_text = null,
      presentation_slot = 'catalog',
      is_featured = false
  where season_id = v_season_id;

  update public.season_products sp
  set campaign_name = 'Dúo de barras rellenas · 120 g',
      campaign_description = 'Elige dos barras entre Dubái y Explosión de Supernova.',
      campaign_image_url = '/campaigns/cyber-day-chocolatoso-2026/hero-duo-barras.webp',
      campaign_alt_text = 'Cyber Chocolatoso: dos barras rellenas de 120 g por $17.900',
      presentation_slot = 'hero_offer',
      sort_order = 0
  from public.productos p
  where sp.season_id = v_season_id and sp.product_id = p.id
    and p.business_unit_id = b and p.slug = 'duo-barras-rellenas';

  update public.season_products sp
  set campaign_name = x.campaign_name,
      campaign_description = x.campaign_description,
      campaign_image_url = x.campaign_image_url,
      campaign_alt_text = x.campaign_alt_text,
      presentation_slot = 'featured',
      is_featured = true,
      sort_order = x.sort_order
  from public.productos p
  join (values
    ('brigadeiros-trufas-surtidos', 'Brigadeiros y trufas surtidos', 'Combina seis sabores en cajas de 9, 15 o 24 unidades.', '/campaigns/cyber-day-chocolatoso-2026/brigadeiros-trufas.webp', 'Cajita Cyber de brigadeiros y trufas veganas surtidas', 10),
    ('alfajores-canamo', 'Alfajores de cáñamo', 'Pack de cuatro alfajores; combina sus cuatro sabores.', '/campaigns/cyber-day-chocolatoso-2026/alfajores-canamo.webp', 'Cyber Day: cuatro alfajores veganos de cáñamo', 20),
    ('protein-balls', 'Protein Balls', 'Combina tres sabores en cajas de 9, 15 o 24 unidades.', '/campaigns/cyber-day-chocolatoso-2026/protein-balls.webp', 'Cyber Chocolatoso: Protein Balls veganas', 30),
    ('box-chocolatosa', 'Box Chocolatosa', 'Elige la barra de 80 g que acompaña esta caja de chocolates veganos.', '/campaigns/cyber-day-chocolatoso-2026/box-chocolatosa.webp', 'Box Chocolatosa vegana de Cyber Day', 40),
    ('barra-terremoto', 'Elige tu universo Cyber', 'Dubái, Terremoto o Explosión de Supernova en 120 o 240 g.', '/campaigns/cyber-day-chocolatoso-2026/barras-configurables.webp', 'Barra Terremoto y universos de chocolate Cyber en 120 y 240 g', 50),
    ('promocion-24-bombones', 'Bombones artesanales', 'Combina seis sabores en cajas de 9, 15 o 24 unidades.', '/campaigns/cyber-day-chocolatoso-2026/bombones.webp', 'Bombones veganos premium en seis sabores', 60)
  ) x(slug, campaign_name, campaign_description, campaign_image_url, campaign_alt_text, sort_order)
    on x.slug = p.slug and p.business_unit_id = b
  where sp.season_id = v_season_id and sp.product_id = p.id;

  update public.season_products sp
  set presentation_slot = 'target_only',
      is_featured = false,
      sort_order = x.sort_order
  from public.productos p
  join (values
    ('barra-dubai', 70),
    ('explosion-supernova', 80)
  ) x(slug, sort_order) on x.slug = p.slug and p.business_unit_id = b
  where sp.season_id = v_season_id and sp.product_id = p.id;

  if (
    select count(*) from public.season_products
    where season_id = v_season_id and presentation_slot = 'featured'
  ) <> 6 then
    raise exception 'No se configuraron exactamente seis destacados Cyber; abortar';
  end if;

  if (
    select count(*) from public.season_products
    where season_id = v_season_id and presentation_slot = 'hero_offer'
  ) <> 1 then
    raise exception 'No se configuró exactamente una oferta hero Cyber; abortar';
  end if;

  delete from public.season_product_variant_targets
  where season_id = v_season_id;

  insert into public.season_product_variant_targets (
    business_unit_id, season_id, display_product_id,
    target_product_id, target_variant_id,
    group_label, option_label, sort_order
  )
  select b, v_season_id, display_product.id,
    target_product.id, target_variant.id,
    x.group_label, x.option_label, x.sort_order
  from (values
    ('barra-dubai', 'LMV-DUBAI-120G', 'Dubái', '120 g', 10),
    ('barra-dubai', 'LMV-DUBAI-240G', 'Dubái', '240 g', 20),
    ('barra-terremoto', 'LMV-TERREMOTO-120G', 'Terremoto', '120 g', 30),
    ('barra-terremoto', 'LMV-TERREMOTO-240G', 'Terremoto', '240 g', 40),
    ('explosion-supernova', 'LMV-SUPERNOVA-110', 'Explosión de Supernova', '120 g', 50),
    ('explosion-supernova', 'LMV-SUPERNOVA-230', 'Explosión de Supernova', '240 g', 60)
  ) x(target_slug, target_sku, group_label, option_label, sort_order)
  join public.productos display_product
    on display_product.business_unit_id = b and display_product.slug = 'barra-terremoto'
  join public.productos target_product
    on target_product.business_unit_id = b and target_product.slug = x.target_slug
  join public.product_variants target_variant
    on target_variant.business_unit_id = b
   and target_variant.product_id = target_product.id
   and target_variant.sku = x.target_sku
   and target_variant.is_active;

  if (
    select count(*) from public.season_product_variant_targets
    where season_id = v_season_id
  ) <> 6 then
    raise exception 'No se configuraron exactamente seis destinos de barras Cyber; abortar';
  end if;

  insert into public.product_option_groups (
    business_unit_id, product_id, code, name,
    selection_mode, is_required, is_active, sort_order
  )
  select b, p.id, 'sabores', 'Combina tus sabores',
    'quantity', true, true, 10
  from public.productos p
  where p.business_unit_id = b and p.slug = 'promocion-24-bombones'
  on conflict (product_id, code) do update set
    name = excluded.name,
    selection_mode = excluded.selection_mode,
    is_required = excluded.is_required,
    is_active = excluded.is_active,
    sort_order = excluded.sort_order,
    updated_at = now()
  returning id into v_bombon_group_id;

  insert into public.product_option_values (
    business_unit_id, option_group_id, code, label,
    price_delta, is_active, sort_order
  )
  select b, v_bombon_group_id, x.code, x.label, 0, true, x.sort_order
  from (values
    ('te-chai', 'Ganache cremoso de té chai', 10),
    ('naranja-jengibre-maracuya', 'Compota de naranja, jengibre y trufa bitter de maracuyá', 20),
    ('manzana-choco-canela', 'Manzana confitada y ganache choco-canela', 30),
    ('caramelo-snickers', 'Caramelo salado estilo Snickers', 40),
    ('frutos-rojos-chocolate-55', 'Confitura de frutos rojos y ganache de chocolate 55%', 50),
    ('mokkachino-whisky', 'Mokkachino Whisky', 60)
  ) x(code, label, sort_order)
  on conflict (option_group_id, code) do update set
    label = excluded.label,
    price_delta = 0,
    is_active = true,
    sort_order = excluded.sort_order,
    updated_at = now();

  update public.product_option_values
  set is_active = false, updated_at = now()
  where option_group_id = v_bombon_group_id
    and code not in (
      'te-chai', 'naranja-jengibre-maracuya', 'manzana-choco-canela',
      'caramelo-snickers', 'frutos-rojos-chocolate-55', 'mokkachino-whisky'
    );

  update public.product_variants variant
  set selection_quantity = x.selection_quantity,
      updated_at = now()
  from (values
    ('LMV-BOMB-09', 9),
    ('LMV-BOMB-15', 15),
    ('LMV-BOMB-24', 24)
  ) x(sku, selection_quantity)
  where variant.business_unit_id = b and variant.sku = x.sku;
end $$;

commit;
