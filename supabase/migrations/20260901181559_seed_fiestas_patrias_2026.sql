-- Idempotent commercial seed. Supabase remains the runtime source of truth.
create unique index if not exists product_pack_components_pack_name_key
  on public.product_pack_components (pack_product_id, component_name);

-- Reuse the two existing commercial products instead of duplicating them.
update public.productos
set nombre = 'Seitán Parrillero',
    slug = 'seitan-parrillero',
    descripcion = 'Seitán parrillero de La Manito del Vegano.',
    precio = 6000,
    gramaje = '550g:6000,1kg:9900',
    variedades = null,
    disponibilidad = null,
    imagen_url = 'https://lamanitodelvegano.cl/campaigns/fiestas-patrias-2026/seitan-kostilles.webp',
    images = array['https://lamanitodelvegano.cl/campaigns/fiestas-patrias-2026/seitan-kostilles.webp'],
    sku = 'FP26-SEITAN',
    weight_grams = 550,
    activo = true
where business_unit_id = 'f3b57ce7-0796-40e5-94f1-07cb2b48ba85'
  and slug in ('seitan-de-la-manito', 'seitan-parrillero');

update public.productos
set nombre = 'Le Kostilles',
    slug = 'le-kostilles',
    descripcion = 'Le Kostilles veganas cocinadas en caldos llenos de umami. Formato de 450 g, aproximadamente 5 unidades.',
    precio = 4900,
    gramaje = '450g:4900',
    variedades = 'Barbecue,Mostaza,Finas hierbas,Criollo picante,Sin adobo',
    disponibilidad = null,
    imagen_url = 'https://lamanitodelvegano.cl/campaigns/fiestas-patrias-2026/seitan-kostilles.webp',
    images = array['https://lamanitodelvegano.cl/campaigns/fiestas-patrias-2026/seitan-kostilles.webp'],
    sku = 'FP26-KOST',
    weight_grams = 450,
    activo = true
where business_unit_id = 'f3b57ce7-0796-40e5-94f1-07cb2b48ba85'
  and slug = 'le-kostilles';

with product_seed(nombre, slug, descripcion, precio, gramaje, variedades, disponibilidad, imagen_url, sku, weight_grams) as (
  values
    ('La Empanada del 18', 'empanada-del-18', 'Empanadas veganas artesanales de aproximadamente 220 g cada una. Solo por encargo; disponibles listas para consumo o congeladas.', 2900, '220g:2900,Pack 10:23900', 'Pino de soya,Pino de seitán,Napolitana,Champiñón + queso vegano,Ratatouille,Espinacas a la crema + queso vegano', '2026-09-12,2026-09-15,2026-09-16', 'https://lamanitodelvegano.cl/campaigns/fiestas-patrias-2026/empanada-del-18.webp', 'FP26-EMP', 220),
    ('Pack Parrillero Vegano 1', 'pack-parrillero-vegano-1', 'Incluye 400 g de seitán parrillero, 5 choripanes veganos (aprox. 300 g) y 3 burgers parrilleras. Cupos limitados, solo por encargo; listo para refrigerar o congelar.', 11900, null, null, '2026-09-12,2026-09-15,2026-09-16', null, 'FP26-PARR-01', null),
    ('Pack Parrillero Vegano 2', 'pack-parrillero-vegano-2', 'Incluye 400 g de seitán parrillero, 5 choripanes veganos (aprox. 300 g), 3 burgers parrilleras y Le Kostilles al vacío. Cupos limitados, solo por encargo; listo para refrigerar o congelar.', 15000, null, null, '2026-09-12,2026-09-15,2026-09-16', null, 'FP26-PARR-02', null),
    ('Postres en Frascos', 'postres-en-frascos', 'Postres veganos artesanales en frascos de aproximadamente 350 g. Solo por encargo.', 4000, '350g:4000,Pack 3:10000', 'Tiramisu,Manjar Chantilly,Frambuesa - Chocolate,Pie de Limón,Manjar - Lúcuma,Piña Colada,Manzana + crema de canela + bizcocho crunch de almendra,Cheesecake frambuesa,Cheesecake maracuyá', '2026-09-12,2026-09-15,2026-09-16', 'https://lamanitodelvegano.cl/campaigns/fiestas-patrias-2026/postres-en-frascos.webp', 'FP26-POSTRE', 350),
    ('Dulces Típicos', 'dulces-tipicos', 'Caja surtida de 25 unidades: 5 Chilenitos, 5 Empolvados, 5 Merenguitos, 5 Alfajores decorados y 5 Cachitos. Solo por encargo; lista para consumo.', 14900, '25 unidades:14900', null, '2026-09-12,2026-09-15,2026-09-16', 'https://lamanitodelvegano.cl/campaigns/fiestas-patrias-2026/dulces-tipicos.webp', 'FP26-DULCES-25', null)
)
insert into public.productos (
  business_unit_id, nombre, slug, descripcion, precio, gramaje, variedades,
  disponibilidad, imagen_url, images, sku, weight_grams, activo, maneja_stock,
  destacado, is_featured, etiqueta, etiqueta_label
)
select
  'f3b57ce7-0796-40e5-94f1-07cb2b48ba85'::uuid,
  s.nombre, s.slug, s.descripcion, s.precio, s.gramaje, s.variedades,
  s.disponibilidad, s.imagen_url,
  case when s.imagen_url is null then null else array[s.imagen_url] end,
  s.sku, s.weight_grams, true, false, false, false, 'promo', 'Fiestas Patrias 2026'
from product_seed s
where not exists (
  select 1 from public.productos p
  where p.business_unit_id = 'f3b57ce7-0796-40e5-94f1-07cb2b48ba85'
    and p.slug = s.slug
);

-- Re-running the seed also repairs canonical commercial fields.
with product_seed(nombre, slug, descripcion, precio, gramaje, variedades, disponibilidad, imagen_url, sku, weight_grams) as (
  values
    ('La Empanada del 18', 'empanada-del-18', 'Empanadas veganas artesanales de aproximadamente 220 g cada una. Solo por encargo; disponibles listas para consumo o congeladas.', 2900, '220g:2900,Pack 10:23900', 'Pino de soya,Pino de seitán,Napolitana,Champiñón + queso vegano,Ratatouille,Espinacas a la crema + queso vegano', '2026-09-12,2026-09-15,2026-09-16', 'https://lamanitodelvegano.cl/campaigns/fiestas-patrias-2026/empanada-del-18.webp', 'FP26-EMP', 220),
    ('Pack Parrillero Vegano 1', 'pack-parrillero-vegano-1', 'Incluye 400 g de seitán parrillero, 5 choripanes veganos (aprox. 300 g) y 3 burgers parrilleras. Cupos limitados, solo por encargo; listo para refrigerar o congelar.', 11900, null, null, '2026-09-12,2026-09-15,2026-09-16', null, 'FP26-PARR-01', null),
    ('Pack Parrillero Vegano 2', 'pack-parrillero-vegano-2', 'Incluye 400 g de seitán parrillero, 5 choripanes veganos (aprox. 300 g), 3 burgers parrilleras y Le Kostilles al vacío. Cupos limitados, solo por encargo; listo para refrigerar o congelar.', 15000, null, null, '2026-09-12,2026-09-15,2026-09-16', null, 'FP26-PARR-02', null),
    ('Postres en Frascos', 'postres-en-frascos', 'Postres veganos artesanales en frascos de aproximadamente 350 g. Solo por encargo.', 4000, '350g:4000,Pack 3:10000', 'Tiramisu,Manjar Chantilly,Frambuesa - Chocolate,Pie de Limón,Manjar - Lúcuma,Piña Colada,Manzana + crema de canela + bizcocho crunch de almendra,Cheesecake frambuesa,Cheesecake maracuyá', '2026-09-12,2026-09-15,2026-09-16', 'https://lamanitodelvegano.cl/campaigns/fiestas-patrias-2026/postres-en-frascos.webp', 'FP26-POSTRE', 350),
    ('Dulces Típicos', 'dulces-tipicos', 'Caja surtida de 25 unidades: 5 Chilenitos, 5 Empolvados, 5 Merenguitos, 5 Alfajores decorados y 5 Cachitos. Solo por encargo; lista para consumo.', 14900, '25 unidades:14900', null, '2026-09-12,2026-09-15,2026-09-16', 'https://lamanitodelvegano.cl/campaigns/fiestas-patrias-2026/dulces-tipicos.webp', 'FP26-DULCES-25', null)
)
update public.productos p
set nombre = s.nombre, descripcion = s.descripcion, precio = s.precio,
    gramaje = s.gramaje, variedades = s.variedades, disponibilidad = s.disponibilidad,
    imagen_url = s.imagen_url,
    images = case when s.imagen_url is null then null else array[s.imagen_url] end,
    sku = s.sku, weight_grams = s.weight_grams, activo = true,
    maneja_stock = false, etiqueta = 'promo', etiqueta_label = 'Fiestas Patrias 2026'
from product_seed s
where p.business_unit_id = 'f3b57ce7-0796-40e5-94f1-07cb2b48ba85'
  and p.slug = s.slug;

-- Stable sellable variants. The literal order is part of the tested contract.
insert into public.product_variants (
  business_unit_id, product_id, sku, name, price, weight_grams,
  units_included, selection_quantity, manages_stock, stock, capacity,
  is_active, sort_order, image_url, metadata
)
select p.business_unit_id, p.id, v.sku, v.name, v.price, v.weight_grams,
       v.units_included, v.selection_quantity, false, null, null, true,
       v.sort_order, p.imagen_url, v.metadata
from public.productos p
join (values
  ('empanada-del-18', 'FP26-EMP-UNIT', 'Unidad', 2900, 220, 1, 1, 10, '{"made_to_order":true,"delivery_dates":["2026-09-12","2026-09-15","2026-09-16"]}'::jsonb),
  ('empanada-del-18', 'FP26-EMP-PACK10', 'Pack 10', 23900, 2200, 10, 10, 20, '{"made_to_order":true,"delivery_dates":["2026-09-12","2026-09-15","2026-09-16"]}'::jsonb),
  ('pack-parrillero-vegano-1', 'FP26-PARR-01', 'Pack', 11900, null, 1, 0, 10, '{"made_to_order":true,"limited_capacity":true,"storage":["refrigerar","congelar"],"delivery_dates":["2026-09-12","2026-09-15","2026-09-16"]}'::jsonb),
  ('pack-parrillero-vegano-2', 'FP26-PARR-02', 'Pack', 15000, null, 1, 0, 10, '{"made_to_order":true,"limited_capacity":true,"storage":["refrigerar","congelar"],"delivery_dates":["2026-09-12","2026-09-15","2026-09-16"]}'::jsonb),
  ('postres-en-frascos', 'FP26-POSTRE-UNIT', 'Unidad', 4000, 350, 1, 1, 10, '{"made_to_order":true,"delivery_dates":["2026-09-12","2026-09-15","2026-09-16"]}'::jsonb),
  ('postres-en-frascos', 'FP26-POSTRE-PACK3', 'Pack 3', 10000, 1050, 3, 3, 20, '{"made_to_order":true,"delivery_dates":["2026-09-12","2026-09-15","2026-09-16"]}'::jsonb),
  ('seitan-parrillero', 'FP26-SEITAN-550', '550 g', 6000, 550, 1, 0, 10, '{}'::jsonb),
  ('seitan-parrillero', 'FP26-SEITAN-1000', '1 kg', 9900, 1000, 1, 0, 20, '{}'::jsonb),
  ('le-kostilles', 'FP26-KOST-450', '450 g (aprox. 5 unidades)', 4900, 450, 1, 0, 10, '{}'::jsonb),
  ('dulces-tipicos', 'FP26-DULCES-25', 'Caja surtida 25 unidades', 14900, null, 25, 0, 10, '{"made_to_order":true,"delivery_dates":["2026-09-12","2026-09-15","2026-09-16"]}'::jsonb)
) as v(slug, sku, name, price, weight_grams, units_included, selection_quantity, sort_order, metadata)
  on v.slug = p.slug
where p.business_unit_id = 'f3b57ce7-0796-40e5-94f1-07cb2b48ba85'
on conflict (business_unit_id, sku) do update set
  product_id = excluded.product_id, name = excluded.name, price = excluded.price,
  weight_grams = excluded.weight_grams, units_included = excluded.units_included,
  selection_quantity = excluded.selection_quantity, manages_stock = excluded.manages_stock,
  stock = excluded.stock, capacity = excluded.capacity, is_active = excluded.is_active,
  sort_order = excluded.sort_order, image_url = excluded.image_url,
  metadata = excluded.metadata, updated_at = now();

-- Option groups.
insert into public.product_option_groups (
  business_unit_id, product_id, code, name, selection_mode, is_required, is_active, sort_order
)
select p.business_unit_id, p.id, g.code, g.name, g.selection_mode, true, true, g.sort_order
from public.productos p
join (values
  ('empanada-del-18', 'sabor', 'Sabores', 'quantity', 10),
  ('empanada-del-18', 'modalidad', 'Modalidad', 'single', 20),
  ('postres-en-frascos', 'sabor', 'Sabores', 'quantity', 10),
  ('le-kostilles', 'adobo', 'Adobo', 'single', 10)
) as g(slug, code, name, selection_mode, sort_order) on g.slug = p.slug
where p.business_unit_id = 'f3b57ce7-0796-40e5-94f1-07cb2b48ba85'
on conflict (product_id, code) do update set
  name = excluded.name, selection_mode = excluded.selection_mode,
  is_required = excluded.is_required, is_active = excluded.is_active,
  sort_order = excluded.sort_order, updated_at = now();

-- Authorized option values. Prices stay exclusively on variants.
insert into public.product_option_values (
  business_unit_id, option_group_id, code, label, price_delta, is_active, sort_order
)
select g.business_unit_id, g.id, v.code, v.label, 0, true, v.sort_order
from public.product_option_groups g
join public.productos p on p.id = g.product_id and p.business_unit_id = g.business_unit_id
join (values
  ('empanada-del-18', 'sabor', 'pino-soya', 'Pino de soya', 10),
  ('empanada-del-18', 'sabor', 'pino-seitan', 'Pino de seitán', 20),
  ('empanada-del-18', 'sabor', 'napolitana', 'Napolitana', 30),
  ('empanada-del-18', 'sabor', 'champinon-queso-vegano', 'Champiñón + queso vegano', 40),
  ('empanada-del-18', 'sabor', 'ratatouille', 'Ratatouille', 50),
  ('empanada-del-18', 'sabor', 'espinacas-crema-queso-vegano', 'Espinacas a la crema + queso vegano', 60),
  ('empanada-del-18', 'modalidad', 'lista-consumo', 'Lista para consumo', 10),
  ('empanada-del-18', 'modalidad', 'congelada', 'Congelada', 20),
  ('postres-en-frascos', 'sabor', 'tiramisu', 'Tiramisu', 10),
  ('postres-en-frascos', 'sabor', 'manjar-chantilly', 'Manjar Chantilly', 20),
  ('postres-en-frascos', 'sabor', 'frambuesa-chocolate', 'Frambuesa - Chocolate', 30),
  ('postres-en-frascos', 'sabor', 'pie-limon', 'Pie de Limón', 40),
  ('postres-en-frascos', 'sabor', 'manjar-lucuma', 'Manjar - Lúcuma', 50),
  ('postres-en-frascos', 'sabor', 'pina-colada', 'Piña Colada', 60),
  ('postres-en-frascos', 'sabor', 'manzana-canela-almendra', 'Manzana + crema de canela + bizcocho crunch de almendra', 70),
  ('postres-en-frascos', 'sabor', 'cheesecake-frambuesa', 'Cheesecake frambuesa', 80),
  ('postres-en-frascos', 'sabor', 'cheesecake-maracuya', 'Cheesecake maracuyá', 90),
  ('le-kostilles', 'adobo', 'barbecue', 'Barbecue', 10),
  ('le-kostilles', 'adobo', 'mostaza', 'Mostaza', 20),
  ('le-kostilles', 'adobo', 'finas-hierbas', 'Finas hierbas', 30),
  ('le-kostilles', 'adobo', 'criollo-picante', 'Criollo picante', 40),
  ('le-kostilles', 'adobo', 'sin-adobo', 'Sin adobo', 50)
) as v(slug, group_code, code, label, sort_order)
  on v.slug = p.slug and v.group_code = g.code
where p.business_unit_id = 'f3b57ce7-0796-40e5-94f1-07cb2b48ba85'
on conflict (option_group_id, code) do update set
  label = excluded.label, price_delta = 0, is_active = true,
  sort_order = excluded.sort_order, updated_at = now();

-- Normalized fixed pack composition; commercial products are linked where they exist.
insert into public.product_pack_components (
  business_unit_id, pack_product_id, component_product_id,
  component_name, quantity, unit, weight_grams, sort_order
)
select pack.business_unit_id, pack.id, component.id,
       c.component_name, c.quantity, c.unit, c.weight_grams, c.sort_order
from public.productos pack
join (values
  ('pack-parrillero-vegano-1', 'seitan-parrillero', 'Seitán parrillero', 400::numeric, 'g', 400, 10),
  ('pack-parrillero-vegano-1', null, 'Choripanes veganos', 5, 'unidades', 300, 20),
  ('pack-parrillero-vegano-1', null, 'Burgers parrilleras', 3, 'unidades', null, 30),
  ('pack-parrillero-vegano-2', 'seitan-parrillero', 'Seitán parrillero', 400, 'g', 400, 10),
  ('pack-parrillero-vegano-2', null, 'Choripanes veganos', 5, 'unidades', 300, 20),
  ('pack-parrillero-vegano-2', null, 'Burgers parrilleras', 3, 'unidades', null, 30),
  ('pack-parrillero-vegano-2', 'le-kostilles', 'Le Kostilles al vacío', 1, 'pack', null, 40),
  ('dulces-tipicos', null, 'Chilenitos', 5, 'unidades', null, 10),
  ('dulces-tipicos', null, 'Empolvados', 5, 'unidades', null, 20),
  ('dulces-tipicos', null, 'Merenguitos', 5, 'unidades', null, 30),
  ('dulces-tipicos', null, 'Alfajores decorados', 5, 'unidades', null, 40),
  ('dulces-tipicos', null, 'Cachitos', 5, 'unidades', null, 50)
) as c(pack_slug, component_slug, component_name, quantity, unit, weight_grams, sort_order)
  on c.pack_slug = pack.slug
left join public.productos component
  on component.business_unit_id = pack.business_unit_id and component.slug = c.component_slug
where pack.business_unit_id = 'f3b57ce7-0796-40e5-94f1-07cb2b48ba85'
on conflict (pack_product_id, component_name) do update set
  component_product_id = excluded.component_product_id,
  quantity = excluded.quantity, unit = excluded.unit,
  weight_grams = excluded.weight_grams, sort_order = excluded.sort_order;

insert into public.seasons (
  business_unit_id, name, slug, description, starts_at, ends_at,
  color_start, color_end, is_active, banner_image, badge_text, campaign_tag,
  visible_web, visible_whatsapp, visible_instagram, available_to_remy
)
values (
  'f3b57ce7-0796-40e5-94f1-07cb2b48ba85', 'Fiestas Patrias 2026',
  'fiestas-patrias-2026', 'Promociones veganas por encargo para Fiestas Patrias 2026.',
  '2026-09-01T00:00:00-04:00', '2026-09-16T23:59:59-03:00',
  '#002f6c', '#d52b1e', true,
  'https://lamanitodelvegano.cl/campaigns/fiestas-patrias-2026/banner-fiestas-patrias-2026.webp',
  'Fiestas Patrias 2026', 'fiestas-patrias-2026', true, true, true, true
)
on conflict (business_unit_id, campaign_tag) where campaign_tag is not null do update set
  name = excluded.name, slug = excluded.slug, description = excluded.description,
  starts_at = excluded.starts_at, ends_at = excluded.ends_at,
  color_start = excluded.color_start, color_end = excluded.color_end,
  is_active = excluded.is_active, banner_image = excluded.banner_image,
  badge_text = excluded.badge_text, visible_web = excluded.visible_web,
  visible_whatsapp = excluded.visible_whatsapp,
  visible_instagram = excluded.visible_instagram,
  available_to_remy = excluded.available_to_remy, updated_at = now();

insert into public.season_products (
  season_id, product_id, visible_web, visible_whatsapp, visible_instagram,
  available_to_remy, is_featured, sort_order
)
select s.id, p.id, cfg.visible_web, true, true, true, cfg.is_featured, cfg.sort_order
from public.seasons s
join (values
  ('La Empanada del 18', 'empanada-del-18', true, true, 10),
  ('Pack Parrillero Vegano 1', 'pack-parrillero-vegano-1', true, true, 20),
  ('Pack Parrillero Vegano 2', 'pack-parrillero-vegano-2', true, true, 30),
  ('Postres en Frascos', 'postres-en-frascos', true, true, 40),
  ('Seitán Parrillero', 'seitan-parrillero', true, true, 50),
  ('Le Kostilles', 'le-kostilles', true, true, 60),
  ('Dulces Típicos', 'dulces-tipicos', false, false, 70)
) as cfg(product_name, slug, visible_web, is_featured, sort_order) on true
join public.productos p
  on p.business_unit_id = s.business_unit_id and p.slug = cfg.slug
where s.business_unit_id = 'f3b57ce7-0796-40e5-94f1-07cb2b48ba85'
  and s.campaign_tag = 'fiestas-patrias-2026'
on conflict (season_id, product_id) do update set
  visible_web = excluded.visible_web,
  visible_whatsapp = excluded.visible_whatsapp,
  visible_instagram = excluded.visible_instagram,
  available_to_remy = excluded.available_to_remy,
  is_featured = excluded.is_featured,
  sort_order = excluded.sort_order;
