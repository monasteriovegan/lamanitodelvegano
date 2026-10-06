-- Corrige la primera ejecución de Cyber Day: los flyers son assets de campaña,
-- no imágenes maestras del catálogo.
begin;
do $$
declare
  b uuid := 'f3b57ce7-0796-40e5-94f1-07cb2b48ba85';
begin
  update public.productos p
  set imagen_url = x.image_url,
      images = array[x.image_url]
  from (values
    ('barra-dubai', 'https://lamanitodelvegano.cl/products/barra-dubai.jpg'),
    ('explosion-supernova', 'https://lamanitodelvegano.cl/campaigns/especial-fin-de-semana/supernova.png'),
    ('protein-balls', 'https://lamanitodelvegano.cl/products/protein-balls.jpg'),
    ('brigadeiros-trufas-surtidos', 'https://lamanitodelvegano.cl/products/brigadeiros-trufas-surtidos.jpg'),
    ('promocion-24-bombones', 'https://supabase.lamanitodelvegano.cl/storage/v1/object/public/productos/ads-media/2026-10-01/1790877111796-232b67de-24d7-44cd-a433-5cb8d9be7c68.png'),
    ('alfajores-canamo', 'https://lamanitodelvegano.cl/products/alfajores-canamo.jpg')
  ) x(slug, image_url) on x.slug = p.slug
  where p.business_unit_id = b;
end $$;
commit;
