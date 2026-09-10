-- Migración canónica: Incorporación de 5 nuevos productos a Dulces & Chocolatería
-- Idempotente. Fuente de verdad: Supabase adrydqvahzqjbgtcvlay

-- 1. Crear categoría 'Dulces & Chocolatería' si no existe
insert into public.categorias (id, nombre, emoji, slug)
values ('dulces-chocolateria', 'Dulces & Chocolatería', '🍫', 'dulces-chocolateria')
on conflict (id) do update
set nombre = excluded.nombre,
    emoji = excluded.emoji,
    slug = excluded.slug;

-- 2. Inserción / actualización de los 5 productos en public.productos
with new_products(nombre, slug, categoria, descripcion, precio, precio_anterior, emoji, color_fondo, imagen_url, sku, weight_grams, gluten_free, nut_free) as (
  values
    (
      'Protein Balls',
      'protein-balls',
      'Dulces & Chocolatería',
      'Protein Balls veganas con cáñamo + mung. Aproximadamente 4 g de proteína por unidad. Sin azúcar, endulzadas con alulosa.',
      10900,
      null::integer,
      '🍫',
      '#2b1d14',
      'https://lamanitodelvegano.cl/products/protein-balls.jpg',
      'LMV-PBALL',
      null::integer,
      true,
      false
    ),
    (
      'Brigadeiros & Trufas surtidos',
      'brigadeiros-trufas-surtidos',
      'Dulces & Chocolatería',
      'Cajita surtida de brigadeiros y trufas 100% veganos artesanales a base de cáñamo y cacao.',
      10900,
      null::integer,
      '🍬',
      '#241812',
      'https://lamanitodelvegano.cl/products/brigadeiros-trufas-surtidos.jpg',
      'LMV-TRUFA',
      null::integer,
      true,
      false
    ),
    (
      'Box Rollitos de Canela',
      'box-rollitos-canela',
      'Dulces & Chocolatería',
      'Box de 6 rollitos de canela 100% veganos horneados artesanalmente con tus toppings favoritos.',
      10900,
      null::integer,
      '🥮',
      '#3b2314',
      'https://lamanitodelvegano.cl/products/box-rollitos-canela.jpg',
      'LMV-ROLL',
      null::integer,
      false,
      null::boolean
    ),
    (
      'Barra Dubái',
      'barra-dubai',
      'Dulces & Chocolatería',
      'Chocolate vegano relleno de crema de pistacho y kunafa crujiente. Artesanal, vegana e irresistible.',
      10900,
      12900,
      '🍫',
      '#1e3522',
      'https://lamanitodelvegano.cl/products/barra-dubai.jpg',
      'LMV-DUBAI',
      120,
      false,
      false
    ),
    (
      'Alfajores de Cáñamo',
      'alfajores-canamo',
      'Dulces & Chocolatería',
      'Alfajores veganos proteicos de cáñamo, aprox. 60 g cada uno y 13 g de proteína por unidad. Altos en Omega 3 y 6, endulzados con alulosa, libres de gluten y soya.',
      3500,
      null::integer,
      '🍪',
      '#233221',
      'https://lamanitodelvegano.cl/products/alfajores-canamo.jpg',
      'LMV-ALF-HEMP',
      60,
      true,
      false
    )
)
insert into public.productos (
  business_unit_id, nombre, slug, categoria, descripcion, precio, precio_anterior,
  emoji, color_fondo, imagen_url, images, sku, weight_grams, gluten_free, nut_free,
  activo, maneja_stock, stock, destacado, is_featured, is_new
)
select
  'f3b57ce7-0796-40e5-94f1-07cb2b48ba85'::uuid,
  np.nombre, np.slug, np.categoria, np.descripcion, np.precio, np.precio_anterior,
  np.emoji, np.color_fondo, np.imagen_url, array[np.imagen_url], np.sku, np.weight_grams,
  np.gluten_free, np.nut_free, true, false, null, false, false, true
from new_products np
where not exists (
  select 1 from public.productos p
  where p.business_unit_id = 'f3b57ce7-0796-40e5-94f1-07cb2b48ba85'
    and p.slug = np.slug
);

-- Actualizar si ya existen
with new_products(nombre, slug, categoria, descripcion, precio, precio_anterior, emoji, color_fondo, imagen_url, sku, weight_grams, gluten_free, nut_free) as (
  values
    (
      'Protein Balls',
      'protein-balls',
      'Dulces & Chocolatería',
      'Protein Balls veganas con cáñamo + mung. Aproximadamente 4 g de proteína por unidad. Sin azúcar, endulzadas con alulosa.',
      10900,
      null::integer,
      '🍫',
      '#2b1d14',
      'https://lamanitodelvegano.cl/products/protein-balls.jpg',
      'LMV-PBALL',
      null::integer,
      true,
      false
    ),
    (
      'Brigadeiros & Trufas surtidos',
      'brigadeiros-trufas-surtidos',
      'Dulces & Chocolatería',
      'Cajita surtida de brigadeiros y trufas 100% veganos artesanales a base de cáñamo y cacao.',
      10900,
      null::integer,
      '🍬',
      '#241812',
      'https://lamanitodelvegano.cl/products/brigadeiros-trufas-surtidos.jpg',
      'LMV-TRUFA',
      null::integer,
      true,
      false
    ),
    (
      'Box Rollitos de Canela',
      'box-rollitos-canela',
      'Dulces & Chocolatería',
      'Box de 6 rollitos de canela 100% veganos horneados artesanalmente con tus toppings favoritos.',
      10900,
      null::integer,
      '🥮',
      '#3b2314',
      'https://lamanitodelvegano.cl/products/box-rollitos-canela.jpg',
      'LMV-ROLL',
      null::integer,
      false,
      null::boolean
    ),
    (
      'Barra Dubái',
      'barra-dubai',
      'Dulces & Chocolatería',
      'Chocolate vegano relleno de crema de pistacho y kunafa crujiente. Artesanal, vegana e irresistible.',
      10900,
      12900,
      '🍫',
      '#1e3522',
      'https://lamanitodelvegano.cl/products/barra-dubai.jpg',
      'LMV-DUBAI',
      120,
      false,
      false
    ),
    (
      'Alfajores de Cáñamo',
      'alfajores-canamo',
      'Dulces & Chocolatería',
      'Alfajores veganos proteicos de cáñamo, aprox. 60 g cada uno y 13 g de proteína por unidad. Altos en Omega 3 y 6, endulzados con alulosa, libres de gluten y soya.',
      3500,
      null::integer,
      '🍪',
      '#233221',
      'https://lamanitodelvegano.cl/products/alfajores-canamo.jpg',
      'LMV-ALF-HEMP',
      60,
      true,
      false
    )
)
update public.productos p
set nombre = np.nombre,
    categoria = np.categoria,
    descripcion = np.descripcion,
    precio = np.precio,
    precio_anterior = np.precio_anterior,
    emoji = np.emoji,
    color_fondo = np.color_fondo,
    imagen_url = np.imagen_url,
    images = array[np.imagen_url],
    sku = np.sku,
    weight_grams = np.weight_grams,
    gluten_free = np.gluten_free,
    nut_free = np.nut_free,
    activo = true,
    is_new = true
from new_products np
where p.business_unit_id = 'f3b57ce7-0796-40e5-94f1-07cb2b48ba85'
  and p.slug = np.slug;

-- 3. Inserción de variantes en public.product_variants
insert into public.product_variants (
  business_unit_id, product_id, sku, name, price, compare_at_price,
  weight_grams, units_included, selection_quantity, manages_stock,
  stock, is_active, sort_order, image_url
)
select
  p.business_unit_id, p.id, v.sku, v.name, v.price, v.compare_at_price,
  v.weight_grams, v.units_included, v.selection_quantity, false,
  null, true, v.sort_order, p.imagen_url
from public.productos p
join (values
  ('protein-balls', 'LMV-PBALL-09', '9 unidades', 10900, null::integer, null::integer, 9, 9, 10),
  ('protein-balls', 'LMV-PBALL-15', '15 unidades', 15900, null::integer, null::integer, 15, 15, 20),
  ('protein-balls', 'LMV-PBALL-24', '24 unidades', 19900, null::integer, null::integer, 24, 24, 30),

  ('brigadeiros-trufas-surtidos', 'LMV-TRUFA-09', '9 unidades', 10900, null::integer, null::integer, 9, 9, 10),
  ('brigadeiros-trufas-surtidos', 'LMV-TRUFA-15', '15 unidades', 15900, null::integer, null::integer, 15, 15, 20),
  ('brigadeiros-trufas-surtidos', 'LMV-TRUFA-24', '24 unidades', 19900, null::integer, null::integer, 24, 24, 30),

  ('box-rollitos-canela', 'LMV-ROLL-06', 'Box 6 unidades', 10900, null::integer, null::integer, 6, 6, 10),

  ('barra-dubai', 'LMV-DUBAI-120G', '120 g', 10900, 12900, 120, 1, 0, 10),
  ('barra-dubai', 'LMV-DUBAI-240G', '240 g', 18900, 21900, 240, 1, 0, 20),

  ('alfajores-canamo', 'LMV-ALF-HEMP-01', '1 unidad', 3500, null::integer, 60, 1, 1, 10),
  ('alfajores-canamo', 'LMV-ALF-HEMP-04', 'Pack 4', 11900, null::integer, 240, 4, 4, 20)
) as v(product_slug, sku, name, price, compare_at_price, weight_grams, units_included, selection_quantity, sort_order)
  on p.slug = v.product_slug
where p.business_unit_id = 'f3b57ce7-0796-40e5-94f1-07cb2b48ba85'
on conflict (business_unit_id, sku) do update
set name = excluded.name,
    price = excluded.price,
    compare_at_price = excluded.compare_at_price,
    weight_grams = excluded.weight_grams,
    units_included = excluded.units_included,
    selection_quantity = excluded.selection_quantity,
    is_active = true,
    sort_order = excluded.sort_order,
    image_url = excluded.image_url;

-- 4. Inserción de Grupos de Opciones en public.product_option_groups
insert into public.product_option_groups (
  business_unit_id, product_id, code, name, selection_mode, is_required, is_active, sort_order
)
select
  p.business_unit_id, p.id, g.code, g.name, g.selection_mode, g.is_required, true, g.sort_order
from public.productos p
join (values
  ('protein-balls', 'sabores', 'Sabores', 'quantity', true, 10),
  ('brigadeiros-trufas-surtidos', 'sabores', 'Sabores', 'quantity', true, 10),
  ('box-rollitos-canela', 'toppings', 'Toppings / Sabores', 'quantity', true, 10),
  ('alfajores-canamo', 'sabores', 'Rellenos / Sabores', 'quantity', true, 10)
) as g(product_slug, code, name, selection_mode, is_required, sort_order)
  on p.slug = g.product_slug
where p.business_unit_id = 'f3b57ce7-0796-40e5-94f1-07cb2b48ba85'
on conflict (business_unit_id, product_id, code) do update
set name = excluded.name,
    selection_mode = excluded.selection_mode,
    is_required = excluded.is_required,
    is_active = true,
    sort_order = excluded.sort_order;

-- 5. Inserción de Valores de Opciones en public.product_option_values
insert into public.product_option_values (
  business_unit_id, option_group_id, code, label, price_delta, is_active, sort_order
)
select
  pog.business_unit_id, pog.id, val.code, val.label, 0, true, val.sort_order
from public.product_option_groups pog
join public.productos p on p.id = pog.product_id and p.business_unit_id = pog.business_unit_id
join (values
  ('protein-balls', 'sabores', 'naranja-cacao', 'Naranja confitada + cacao', 10),
  ('protein-balls', 'sabores', 'caramelo-mani', 'Caramelo salado + maní', 20),
  ('protein-balls', 'sabores', 'manzana-canela-bitter', 'Manzana confitada + canela + chocolate bitter', 30),

  ('brigadeiros-trufas-surtidos', 'sabores', 'pistacho-dubai', 'Pistacho Dubái', 10),
  ('brigadeiros-trufas-surtidos', 'sabores', 'manzanas-confitadas-canela', 'Manzanas confitadas y canela', 20),
  ('brigadeiros-trufas-surtidos', 'sabores', 'naranjas-confitadas-trufa-bitter', 'Naranjas confitadas y trufa bitter', 30),
  ('brigadeiros-trufas-surtidos', 'sabores', 'brigadeiro-cafe', 'Brigadeiro café (leche condensada de cáñamo)', 40),
  ('brigadeiros-trufas-surtidos', 'sabores', 'brigadeiro-cacao', 'Brigadeiro cacao (manjar de cáñamo)', 50),
  ('brigadeiros-trufas-surtidos', 'sabores', 'brigadeiro-coco', 'Brigadeiro coco (leche condensada de cáñamo y coco tostado)', 60),

  ('box-rollitos-canela', 'toppings', 'glaseado-vainilla', 'Glaseado vainilla', 10),
  ('box-rollitos-canela', 'toppings', 'glaseado-chocolate', 'Glaseado chocolate', 20),
  ('box-rollitos-canela', 'toppings', 'glaseado-toffee-manzana', 'Glaseado toffee + manzana confitada', 30),
  ('box-rollitos-canela', 'toppings', 'glaseado-naranja', 'Glaseado naranja confitada', 40),

  ('alfajores-canamo', 'sabores', 'manjar-canamo', 'Manjar de cáñamo', 10),
  ('alfajores-canamo', 'sabores', 'pistacho-dubai', 'Pistacho Dubái', 20)
) as val(product_slug, group_code, code, label, sort_order)
  on p.slug = val.product_slug and pog.code = val.group_code
where pog.business_unit_id = 'f3b57ce7-0796-40e5-94f1-07cb2b48ba85'
on conflict (business_unit_id, option_group_id, code) do update
set label = excluded.label,
    price_delta = 0,
    is_active = true,
    sort_order = excluded.sort_order;
