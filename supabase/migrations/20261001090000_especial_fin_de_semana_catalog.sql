-- Catálogo y campaña web: Antojos veganos para el finde.
-- Idempotente: reutiliza productos existentes y agrega únicamente Supernova.
-- campaign_tag, especial-fin-de-semana

do $$
declare
  v_business uuid := 'f3b57ce7-0796-40e5-94f1-07cb2b48ba85';
begin
  insert into public.categorias (id, nombre, emoji, slug) values
    ('proteinas-veganas', 'Proteínas veganas', '🌱', 'proteinas-veganas'),
    ('dulces-proteicos', 'Dulces proteicos', '🍪', 'dulces-proteicos'),
    ('chocolateria', 'Chocolatería', '🍫', 'chocolateria'),
    ('chocolateria-premium', 'Chocolatería premium', '✨', 'chocolateria-premium'),
    ('dulces-pasteleria', 'Dulces y pastelería', '🧁', 'dulces-pasteleria')
  on conflict (id) do update set nombre = excluded.nombre, emoji = excluded.emoji, slug = excluded.slug;

  update public.productos set
    nombre = 'Pack Proteínas 1',
    categoria = 'Proteínas veganas',
    descripcion = 'Seitán lomo 400 g, churrascos de seitán 300 g y Kostilles 400 g. Pack vegano para compartir.',
    precio = 11900, imagen_url = 'https://lamanitodelvegano.cl/campaigns/especial-fin-de-semana/pack-proteinas-1.png',
    images = array['https://lamanitodelvegano.cl/campaigns/especial-fin-de-semana/pack-proteinas-1.png'], activo = true
  where business_unit_id = v_business and slug = 'pack-parrillero-vegano-1';

  update public.productos set
    nombre = 'Pack Proteínas 2',
    categoria = 'Proteínas veganas',
    descripcion = 'Seitán lomo 400 g, churrascos 300 g, Kostilles 400 g y 4 tutitos faker 380 g.',
    precio = 16900, imagen_url = 'https://lamanitodelvegano.cl/campaigns/especial-fin-de-semana/pack-proteinas-2.png',
    images = array['https://lamanitodelvegano.cl/campaigns/especial-fin-de-semana/pack-proteinas-2.png'], activo = true
  where business_unit_id = v_business and slug = 'pack-parrillero-vegano-2';

  update public.productos set
    nombre = 'Seitán preparado', categoria = 'Proteínas veganas',
    descripcion = 'Seitán preparado en dos sabores: mongoliano o al pil pil y finas hierbas.', precio = 6900,
    imagen_url = 'https://lamanitodelvegano.cl/campaigns/especial-fin-de-semana/seitan-mongoliano.png',
    images = array['https://lamanitodelvegano.cl/campaigns/especial-fin-de-semana/seitan-mongoliano.png', 'https://lamanitodelvegano.cl/campaigns/especial-fin-de-semana/seitan-pil-pil.png'], activo = true
  where business_unit_id = v_business and slug = 'seitan-parrillero';

  update public.productos set
    nombre = 'Alfajores de cáñamo', categoria = 'Dulces proteicos',
    descripcion = 'Alfajores de cáñamo, cuatro sabores irresistibles, sin gluten ni soya y con 15 g de proteína cada uno.',
    imagen_url = 'https://lamanitodelvegano.cl/campaigns/especial-fin-de-semana/alfajores-canamo.png',
    images = array['https://lamanitodelvegano.cl/campaigns/especial-fin-de-semana/alfajores-canamo.png'], activo = true
  where business_unit_id = v_business and slug = 'alfajores-canamo';

  update public.productos set
    nombre = 'Barra Dubái', categoria = 'Chocolatería premium',
    descripcion = 'Chocolate vegano relleno de crema de pistacho y kunafa crujiente. Barra artesanal.',
    imagen_url = 'https://lamanitodelvegano.cl/campaigns/especial-fin-de-semana/barra-dubai.png',
    images = array['https://lamanitodelvegano.cl/campaigns/especial-fin-de-semana/barra-dubai.png'], activo = true
  where business_unit_id = v_business and slug = 'barra-dubai';

  update public.productos set
    nombre = 'Protein Balls', categoria = 'Dulces proteicos',
    descripcion = 'Bolitas veganas con proteína de cáñamo y mung: sin azúcar, endulzadas con alulosa.',
    imagen_url = 'https://lamanitodelvegano.cl/campaigns/especial-fin-de-semana/protein-balls.png',
    images = array['https://lamanitodelvegano.cl/campaigns/especial-fin-de-semana/protein-balls.png'], activo = true
  where business_unit_id = v_business and slug = 'protein-balls';

  update public.productos set
    nombre = 'Trufas y Brigadeiros', categoria = 'Chocolatería',
    descripcion = 'Cajita surtida de brigadeiros y trufas 100% veganos artesanales.',
    imagen_url = 'https://lamanitodelvegano.cl/campaigns/especial-fin-de-semana/brigadeiros-trufas.png',
    images = array['https://lamanitodelvegano.cl/campaigns/especial-fin-de-semana/brigadeiros-trufas.png'], activo = true
  where business_unit_id = v_business and slug = 'brigadeiros-trufas-surtidos';

  update public.productos set
    nombre = 'Bombones artesanales', categoria = 'Chocolatería',
    descripcion = 'Bombones veganos artesanales surtidos, ideales para regalar o compartir.', activo = true
  where business_unit_id = v_business and slug = 'promocion-24-bombones';

  update public.productos set categoria = 'Proteínas veganas', activo = true
  where business_unit_id = v_business and slug = 'le-kostilles';

  update public.productos set nombre = 'Mini dulces surtidos', categoria = 'Dulces y pastelería', activo = true
  where business_unit_id = v_business and slug = 'dulces-tipicos';

  update public.productos set nombre = 'Rollitos de canela', categoria = 'Dulces y pastelería', activo = true
  where business_unit_id = v_business and slug = 'box-rollitos-canela';

  insert into public.productos (
    business_unit_id, nombre, slug, categoria, descripcion, precio, precio_anterior, emoji,
    color_fondo, imagen_url, images, sku, weight_grams, gluten_free, nut_free,
    activo, maneja_stock, stock, destacado, is_featured, is_new
  )
  select v_business, 'Explosión de Supernova', 'explosion-supernova', 'Chocolatería premium',
    'Alta chocolatería cósmica: chocolate bitter, maracuyá, frambuesa y coco.', 10900, null,
    '🍫', '#241c12', 'https://lamanitodelvegano.cl/campaigns/especial-fin-de-semana/supernova.png',
    array['https://lamanitodelvegano.cl/campaigns/especial-fin-de-semana/supernova.png'], 'LMV-SUPERNOVA', null,
    true, false, true, false, null, false, false, true
  where not exists (select 1 from public.productos p where p.business_unit_id = v_business and p.slug = 'explosion-supernova');

  update public.productos set
    nombre = 'Explosión de Supernova', categoria = 'Chocolatería premium',
    descripcion = 'Alta chocolatería cósmica: chocolate bitter, maracuyá, frambuesa y coco.', precio = 10900,
    imagen_url = 'https://lamanitodelvegano.cl/campaigns/especial-fin-de-semana/supernova.png',
    images = array['https://lamanitodelvegano.cl/campaigns/especial-fin-de-semana/supernova.png'], activo = true
  where business_unit_id = v_business and slug = 'explosion-supernova';

  insert into public.product_variants (
    business_unit_id, product_id, sku, name, price, compare_at_price, weight_grams,
    units_included, selection_quantity, manages_stock, stock, is_active, sort_order, image_url
  )
  select v_business, p.id, x.sku, x.name, x.price, x.compare_at_price, x.weight_grams,
    1, 0, false, null, true, x.sort_order, p.imagen_url
  from public.productos p
  join (values
    ('pack-parrillero-vegano-1', 'FP26-PARR-01', 'Pack Proteínas 1', 11900, null::integer, null::integer, 10),
    ('pack-parrillero-vegano-2', 'FP26-PARR-02', 'Pack Proteínas 2', 16900, null::integer, null::integer, 10),
    ('seitan-parrillero', 'FP26-SEITAN-550', '1/2 kg', 6900, null::integer, 500, 10),
    ('seitan-parrillero', 'FP26-SEITAN-1000', '1 kg', 11900, null::integer, 1000, 20),
    ('alfajores-canamo', 'LMV-ALF-HEMP-04', 'Pack 4 sabores', 10900, 11900, null::integer, 20),
    ('explosion-supernova', 'LMV-SUPERNOVA-110', '110 g', 10900, null::integer, 110, 10),
    ('explosion-supernova', 'LMV-SUPERNOVA-230', '230 g', 18900, null::integer, 230, 20),
    ('promocion-24-bombones', 'LMV-BOMB-09', '9 unidades', 10900, null::integer, null::integer, 10),
    ('promocion-24-bombones', 'LMV-BOMB-15', '15 unidades', 15900, null::integer, null::integer, 20),
    ('promocion-24-bombones', 'LMV-BOMB-24', '24 unidades', 19900, null::integer, null::integer, 30)
  ) as x(slug, sku, name, price, compare_at_price, weight_grams, sort_order) on x.slug = p.slug
  where p.business_unit_id = v_business
  on conflict (business_unit_id, sku) do update set
    product_id = excluded.product_id, name = excluded.name, price = excluded.price,
    compare_at_price = excluded.compare_at_price, weight_grams = excluded.weight_grams,
    is_active = true, sort_order = excluded.sort_order, image_url = excluded.image_url;

  insert into public.product_option_groups (business_unit_id, product_id, code, name, selection_mode, is_required, is_active, sort_order)
  select v_business, p.id, 'preparacion', 'Preparación / sabor', 'single', true, true, 10
  from public.productos p where p.business_unit_id = v_business and p.slug = 'seitan-parrillero'
  on conflict (product_id, code) do update set name = excluded.name, selection_mode = excluded.selection_mode, is_required = true, is_active = true;

  insert into public.product_option_values (business_unit_id, option_group_id, code, label, price_delta, is_active, sort_order)
  select v_business, g.id, x.code, x.label, 0, true, x.sort_order
  from public.product_option_groups g
  join public.productos p on p.id = g.product_id and p.business_unit_id = g.business_unit_id
  join (values ('mongoliano', 'Seitán mongoliano', 10), ('pil-pil-finas-hierbas', 'Seitán al pil pil y finas hierbas', 20)) x(code, label, sort_order) on true
  where g.business_unit_id = v_business and p.slug = 'seitan-parrillero' and g.code = 'preparacion'
  on conflict (option_group_id, code) do update set label = excluded.label, price_delta = 0, is_active = true, sort_order = excluded.sort_order;

  insert into public.product_option_values (business_unit_id, option_group_id, code, label, price_delta, is_active, sort_order)
  select v_business, g.id, x.code, x.label, 0, true, x.sort_order
  from public.product_option_groups g
  join public.productos p on p.id = g.product_id and p.business_unit_id = g.business_unit_id
  join (values
    ('manjar-canamo', 'Naranja confitada y manjar cáñamo', 10),
    ('pistacho-dubai', 'Pistacho Dubái', 20),
    ('frutos-rojos-trufa-chocolate', 'Centro de frutos rojos y trufa chocolate', 30),
    ('mantequilla-mani-manjar-chocolate', 'Centro mantequilla de maní y manjar chocolate', 40)
  ) x(code, label, sort_order) on true
  where g.business_unit_id = v_business and p.slug = 'alfajores-canamo' and g.code = 'sabores'
  on conflict (option_group_id, code) do update set label = excluded.label, price_delta = 0, is_active = true, sort_order = excluded.sort_order;

  -- Vincular componentes sin crear productos ficticios; Kostilles conserva sus cinco adobos.
  -- Se actualiza por posición para no dejar duplicados heredados de los packs anteriores.
  update public.product_pack_components c
  set component_product_id = component.id, component_name = x.component_name,
      quantity = x.quantity, unit = x.unit, weight_grams = x.weight_grams
  from public.productos pack
  join (values
    ('pack-parrillero-vegano-1', null, 'Seitán lomo', 1::numeric, 'pack', 400, 10),
    ('pack-parrillero-vegano-1', null, 'Churrascos de seitán', 1::numeric, 'pack', 300, 20),
    ('pack-parrillero-vegano-1', 'le-kostilles', 'Kostilles', 1::numeric, 'pack', 400, 30),
    ('pack-parrillero-vegano-2', null, 'Seitán lomo', 1::numeric, 'pack', 400, 10),
    ('pack-parrillero-vegano-2', null, 'Churrascos de seitán', 1::numeric, 'pack', 300, 20),
    ('pack-parrillero-vegano-2', 'le-kostilles', 'Kostilles', 1::numeric, 'pack', 400, 30),
    ('pack-parrillero-vegano-2', null, '4 Tutitos faker', 4::numeric, 'unidades', 380, 40)
  ) x(pack_slug, component_slug, component_name, quantity, unit, weight_grams, sort_order) on x.pack_slug = pack.slug
  left join public.productos component on component.business_unit_id = v_business and component.slug = x.component_slug
  where pack.business_unit_id = v_business and c.pack_product_id = pack.id and c.sort_order = x.sort_order;

  insert into public.product_pack_components (business_unit_id, pack_product_id, component_product_id, component_name, quantity, unit, weight_grams, sort_order)
  select v_business, pack.id, component.id, x.component_name, x.quantity, x.unit, x.weight_grams, x.sort_order
  from public.productos pack
  join (values
    ('pack-parrillero-vegano-1', null, 'Seitán lomo', 1::numeric, 'pack', 400, 10),
    ('pack-parrillero-vegano-1', null, 'Churrascos de seitán', 1::numeric, 'pack', 300, 20),
    ('pack-parrillero-vegano-1', 'le-kostilles', 'Kostilles', 1::numeric, 'pack', 400, 30),
    ('pack-parrillero-vegano-2', null, 'Seitán lomo', 1::numeric, 'pack', 400, 10),
    ('pack-parrillero-vegano-2', null, 'Churrascos de seitán', 1::numeric, 'pack', 300, 20),
    ('pack-parrillero-vegano-2', 'le-kostilles', 'Kostilles', 1::numeric, 'pack', 400, 30),
    ('pack-parrillero-vegano-2', null, '4 Tutitos faker', 4::numeric, 'unidades', 380, 40)
  ) x(pack_slug, component_slug, component_name, quantity, unit, weight_grams, sort_order) on x.pack_slug = pack.slug
  left join public.productos component on component.business_unit_id = v_business and component.slug = x.component_slug
  where pack.business_unit_id = v_business
    and not exists (select 1 from public.product_pack_components old where old.pack_product_id = pack.id and old.sort_order = x.sort_order);

  update public.product_pack_components c
  set component_name = x.component_name, quantity = 5, unit = 'unidades'
  from public.productos p
  join (values
    (10, 'Chilenitos'), (20, 'Delicias'), (30, 'Alfajores'), (40, 'Mendocinos'), (50, 'Merenguitos')
  ) x(sort_order, component_name) on true
  where p.business_unit_id = v_business and p.slug = 'dulces-tipicos'
    and c.pack_product_id = p.id and c.sort_order = x.sort_order;

  insert into public.seasons (
    business_unit_id, name, slug, description, starts_at, ends_at, color_start, color_end,
    is_active, banner_image, badge_text, campaign_tag, visible_web, visible_whatsapp, visible_instagram, available_to_remy
  ) values (
    v_business, 'Especial fin de semana', 'especial-fin-de-semana',
    'Antojos veganos para el finde: dulce + salado.', '2026-10-01T00:00:00-03:00', null,
    '#f6e7bd', '#315b25', true,
    'https://lamanitodelvegano.cl/campaigns/especial-fin-de-semana/antojos-veganos-finde.png',
    'Dulce + salado', 'especial-fin-de-semana', true, true, true, true
  ) on conflict (business_unit_id, campaign_tag) where campaign_tag is not null do update set
    name = excluded.name, slug = excluded.slug, description = excluded.description, starts_at = excluded.starts_at,
    ends_at = excluded.ends_at, color_start = excluded.color_start, color_end = excluded.color_end,
    is_active = true, banner_image = excluded.banner_image, badge_text = excluded.badge_text,
    visible_web = true, visible_whatsapp = true, visible_instagram = true, available_to_remy = true, updated_at = now();

  insert into public.season_products (season_id, product_id, visible_web, visible_whatsapp, visible_instagram, available_to_remy, is_featured, sort_order)
  select s.id, p.id, true, true, true, true, x.is_featured, x.sort_order
  from public.seasons s
  join (values
    ('pack-parrillero-vegano-1', true, 10), ('pack-parrillero-vegano-2', true, 20), ('seitan-parrillero', true, 30),
    ('barra-dubai', true, 40), ('explosion-supernova', true, 50), ('alfajores-canamo', true, 60),
    ('protein-balls', false, 70), ('promocion-24-bombones', false, 80), ('brigadeiros-trufas-surtidos', false, 90),
    ('dulces-tipicos', false, 100), ('box-rollitos-canela', false, 110)
  ) x(slug, is_featured, sort_order) on true
  join public.productos p on p.business_unit_id = s.business_unit_id and p.slug = x.slug and p.activo = true
  where s.business_unit_id = v_business and s.campaign_tag = 'especial-fin-de-semana'
  on conflict (season_id, product_id) do update set visible_web = true, visible_whatsapp = true,
    visible_instagram = true, available_to_remy = true, is_featured = excluded.is_featured, sort_order = excluded.sort_order;
end $$;
