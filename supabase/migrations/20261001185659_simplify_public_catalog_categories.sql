-- Simplifica la navegación pública a cuatro categorías canónicas.
-- Mantiene sincronizados el nombre legado (productos.categoria) y la FK
-- (productos.category_id) para que admin, web y automatizaciones coincidan.

begin;

insert into public.categorias (id, nombre, emoji, slug)
values
  ('proteinas-veganas', 'Proteínas veganas', '🌱', 'proteinas-veganas'),
  ('chocolateria-dulces', 'Chocolatería y dulces', '🍫', 'chocolateria-dulces'),
  ('pasteleria', 'Pastelería', '🧁', 'pasteleria'),
  ('empanadas-pizzas', 'Empanadas y pizzas', '🥟', 'empanadas-pizzas')
on conflict (id) do update
set nombre = excluded.nombre,
    emoji = excluded.emoji,
    slug = excluded.slug;

with product_category_map (slug, category_id, category_name) as (
  values
    ('pack-parrillero-vegano-1', 'proteinas-veganas', 'Proteínas veganas'),
    ('pack-parrillero-vegano-2', 'proteinas-veganas', 'Proteínas veganas'),
    ('seitan-parrillero', 'proteinas-veganas', 'Proteínas veganas'),
    ('le-kostilles', 'proteinas-veganas', 'Proteínas veganas'),
    ('lomo-lyse', 'proteinas-veganas', 'Proteínas veganas'),
    ('alfajores-canamo', 'chocolateria-dulces', 'Chocolatería y dulces'),
    ('barra-dubai', 'chocolateria-dulces', 'Chocolatería y dulces'),
    ('brigadeiros-trufas-surtidos', 'chocolateria-dulces', 'Chocolatería y dulces'),
    ('explosion-supernova', 'chocolateria-dulces', 'Chocolatería y dulces'),
    ('promocion-24-bombones', 'chocolateria-dulces', 'Chocolatería y dulces'),
    ('protein-balls', 'chocolateria-dulces', 'Chocolatería y dulces'),
    ('box-rollitos-canela', 'pasteleria', 'Pastelería'),
    ('dulces-tipicos', 'pasteleria', 'Pastelería'),
    ('postres-en-frascos', 'pasteleria', 'Pastelería'),
    ('empanada-del-18', 'empanadas-pizzas', 'Empanadas y pizzas'),
    ('prueba', 'empanadas-pizzas', 'Empanadas y pizzas')
)
update public.productos as product
set categoria = mapping.category_name,
    category_id = mapping.category_id
from product_category_map as mapping
where product.business_unit_id = 'f3b57ce7-0796-40e5-94f1-07cb2b48ba85'
  and product.slug = mapping.slug;

-- Retira solamente las categorías públicas sustituidas, después de reasignar
-- todos los productos conocidos. La FK usa ON DELETE SET NULL como salvaguarda.
delete from public.categorias
where id not in (
  'proteinas-veganas',
  'chocolateria-dulces',
  'pasteleria',
  'empanadas-pizzas'
);

commit;
