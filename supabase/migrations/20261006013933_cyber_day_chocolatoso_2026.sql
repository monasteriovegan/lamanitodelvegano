-- Cyber Day Chocolatoso. Precio maestro = normal; precio de oferta = override.
-- Entrega: sábado 10 octubre 2026. Cierre viernes 9 a las 23:59 en Chile.
-- No modifica pedidos, integraciones, stock existente ni historial de precios vendidos.
begin;
do $$
declare
  b uuid := 'f3b57ce7-0796-40e5-94f1-07cb2b48ba85';
  v_season_id uuid;
begin
  if (select count(*) from public.productos where business_unit_id=b and slug in
    ('barra-dubai','explosion-supernova','alfajores-canamo','protein-balls','brigadeiros-trufas-surtidos','promocion-24-bombones')) <> 6 then
    raise exception 'Catálogo base Cyber incompleto; abortar antes de aplicar';
  end if;
  if (select count(*) from public.product_variants where business_unit_id=b and is_active and sku in
    ('LMV-PBALL-09','LMV-PBALL-15','LMV-PBALL-24','LMV-TRUFA-09','LMV-TRUFA-15','LMV-TRUFA-24',
     'LMV-BOMB-09','LMV-BOMB-15','LMV-BOMB-24','LMV-ALF-HEMP-04','LMV-DUBAI-120G','LMV-DUBAI-240G','LMV-SUPERNOVA-110','LMV-SUPERNOVA-230')) <> 14 then
    raise exception 'Variantes base Cyber incompletas o inactivas; abortar antes de aplicar';
  end if;
  insert into public.productos (business_unit_id,nombre,slug,categoria,descripcion,precio,emoji,color_fondo,imagen_url,images,sku,activo,maneja_stock,destacado,is_featured)
  select b,x.name,x.slug,'Chocolatería premium',x.description,x.price,'🍫','#241c12',
    'https://lamanitodelvegano.cl/campaigns/cyber-day-chocolatoso-2026/'||x.asset||'.webp',
    array['https://lamanitodelvegano.cl/campaigns/cyber-day-chocolatoso-2026/'||x.asset||'.webp'],x.sku,true,false,true,true
  from (values
    ('barra-terremoto','Barra Terremoto','Chocolate artesanal con piña, pipeño y granadina.',10900,'barra-xl','LMV-TERREMOTO'),
    ('duo-barras-rellenas','Dúo de barras rellenas · 120 g','2 barras de 120 g. Combina Dubái y Explosión de Supernova como quieras.',21800,'barras','LMV-CYBER-DUO'),
    ('box-chocolatosa','Box Chocolatosa','Barra de chocolate de 80 g a elección, 3 alfajores, 3 bombones, 3 trufas, barrita proteica de cáñamo y bolsita de 30 g de chocolate en rama.',21900,'box-chocolatosa','LMV-BOX-CHOCO')
  ) x(slug,name,description,price,asset,sku)
  where not exists (select 1 from public.productos p where p.business_unit_id=b and p.slug=x.slug);

  -- Valores normales explícitamente acordados. No usar el valor errado del flyer de 9 bombones.
  update public.product_variants v set price=x.price, compare_at_price=null
  from (values
    ('LMV-PBALL-09',11900),('LMV-PBALL-15',19900),('LMV-PBALL-24',23900),
    ('LMV-TRUFA-09',11900),('LMV-TRUFA-15',19900),('LMV-TRUFA-24',23900),
    ('LMV-BOMB-09',11900),('LMV-BOMB-15',19900),('LMV-BOMB-24',23900),
    ('LMV-ALF-HEMP-04',11900),('LMV-DUBAI-120G',10900),('LMV-DUBAI-240G',22900),
    ('LMV-SUPERNOVA-110',10900),('LMV-SUPERNOVA-230',22900)
  ) x(sku,price) where v.business_unit_id=b and v.sku=x.sku;
  -- Conservar IDs/SKUs para referencias históricas; actualizar sólo presentación y peso actual.
  update public.product_variants set name='120 g',weight_grams=120 where business_unit_id=b and sku='LMV-SUPERNOVA-110';
  update public.product_variants set name='240 g',weight_grams=240 where business_unit_id=b and sku='LMV-SUPERNOVA-230';

  insert into public.product_variants (business_unit_id,product_id,sku,name,price,weight_grams,units_included,selection_quantity,manages_stock,is_active,sort_order)
  select b,p.id,x.sku,x.name,x.price,x.weight,x.units,x.selections,false,true,x.sort_order
  from public.productos p join (values
    ('barra-terremoto','LMV-TERREMOTO-120G','120 g',10900,120,1,0,10),
    ('barra-terremoto','LMV-TERREMOTO-240G','240 g',22900,240,1,0,20),
    ('duo-barras-rellenas','LMV-CYBER-DUO-120G','2 barras de 120 g',21800,240,2,2,10),
    ('box-chocolatosa','LMV-BOX-CHOCO-80G','Box con barra de 80 g',21900,null::integer,1,0,10)
  ) x(slug,sku,name,price,weight,units,selections,sort_order) on x.slug=p.slug
  where p.business_unit_id=b
  on conflict (business_unit_id,sku) do update set name=excluded.name,price=excluded.price,weight_grams=excluded.weight_grams,
    units_included=excluded.units_included,selection_quantity=excluded.selection_quantity,is_active=true;

  -- Las tarjetas del catálogo conservan la foto maestra del producto. Los flyers
  -- Cyber se muestran únicamente en CampaignCatalog, no se escriben en productos.
  update public.productos p set precio=x.price,precio_anterior=null,destacado=true,is_featured=true,activo=true
  from (values
    ('barra-dubai',10900,'barras'),('explosion-supernova',10900,'barras'),('barra-terremoto',10900,'barra-xl'),
    ('duo-barras-rellenas',21800,'barras'),('box-chocolatosa',21900,'box-chocolatosa'),
    ('protein-balls',11900,'protein-balls'),('brigadeiros-trufas-surtidos',11900,'trufas'),
    ('promocion-24-bombones',11900,'bombones'),('alfajores-canamo',3500,'alfajores')
  ) x(slug,price,asset) where p.business_unit_id=b and p.slug=x.slug;
  update public.productos set descripcion='Barra de chocolate de 80 g a elección, 3 alfajores, 3 bombones, 3 trufas, barrita proteica de cáñamo y bolsita de 30 g de chocolate en rama.'
    where business_unit_id=b and slug='box-chocolatosa';

  insert into public.product_option_groups (business_unit_id,product_id,code,name,selection_mode,is_required,is_active,sort_order)
  select b,p.id,'sabores','Combina tus barras','quantity',true,true,10 from public.productos p where p.business_unit_id=b and p.slug='duo-barras-rellenas'
  on conflict (product_id,code) do update set selection_mode='quantity',is_required=true,is_active=true;
  insert into public.product_option_values (business_unit_id,option_group_id,code,label,price_delta,is_active,sort_order)
  select b,g.id,x.code,x.label,0,true,x.sort_order from public.product_option_groups g join public.productos p on p.id=g.product_id
  cross join (values ('dubai','Dubái',10),('supernova','Explosión de Supernova',20)) x(code,label,sort_order)
  where p.business_unit_id=b and p.slug='duo-barras-rellenas' and g.code='sabores'
  on conflict (option_group_id,code) do update set label=excluded.label,price_delta=0,is_active=true;
  insert into public.product_option_groups (business_unit_id,product_id,code,name,selection_mode,is_required,is_active,sort_order)
  select b,p.id,'barra','Barra de 80 g a elección','single',true,true,10 from public.productos p where p.business_unit_id=b and p.slug='box-chocolatosa'
  on conflict (product_id,code) do update set selection_mode='single',is_required=true,is_active=true;
  insert into public.product_option_values (business_unit_id,option_group_id,code,label,price_delta,is_active,sort_order)
  select b,g.id,x.code,x.label,0,true,x.sort_order from public.product_option_groups g join public.productos p on p.id=g.product_id
  cross join (values ('dubai','Dubái',10),('terremoto','Terremoto',20),('supernova','Explosión de Supernova',30)) x(code,label,sort_order)
  where p.business_unit_id=b and p.slug='box-chocolatosa' and g.code='barra'
  on conflict (option_group_id,code) do update set label=excluded.label,price_delta=0,is_active=true;

  update public.seasons set is_active=false,updated_at=now() where business_unit_id=b and campaign_tag='especial-fin-de-semana';
  insert into public.seasons (business_unit_id,name,slug,description,starts_at,ends_at,color_start,color_end,is_active,banner_image,badge_text,campaign_tag,visible_web,visible_whatsapp,visible_instagram,available_to_remy)
  values (b,'Cyber Day Chocolatoso','cyber-day-chocolatoso-2026','Ofertas de chocolatería artesanal y 25% de descuento en el resto del catálogo. Entrega sábado 10 de octubre de 2026.',
    '2026-10-05T00:00:00-03:00','2026-10-09T23:59:59-03:00','#241c12','#c99942',true,
    'https://lamanitodelvegano.cl/campaigns/cyber-day-chocolatoso-2026/barras.webp','Entrega sábado 10 de octubre','cyber-day-chocolatoso-2026',true,true,true,true)
  on conflict (business_unit_id,campaign_tag) where campaign_tag is not null do update set name=excluded.name,description=excluded.description,
    starts_at=excluded.starts_at,ends_at=excluded.ends_at,banner_image=excluded.banner_image,badge_text=excluded.badge_text,
    is_active=true,visible_web=true,visible_whatsapp=true,visible_instagram=true,available_to_remy=true,updated_at=now()
  returning id into v_season_id;

  insert into public.season_products (season_id,product_id,visible_web,visible_whatsapp,visible_instagram,available_to_remy,is_featured,sort_order)
  select v_season_id,p.id,true,true,true,true,
    p.slug in ('duo-barras-rellenas','barra-dubai','barra-terremoto','explosion-supernova','protein-balls','brigadeiros-trufas-surtidos','promocion-24-bombones','alfajores-canamo','box-chocolatosa'),
    case p.slug when 'duo-barras-rellenas' then 10 when 'barra-dubai' then 20 when 'barra-terremoto' then 30 when 'explosion-supernova' then 40
      when 'promocion-24-bombones' then 50 when 'brigadeiros-trufas-surtidos' then 60 when 'protein-balls' then 70 when 'alfajores-canamo' then 80 when 'box-chocolatosa' then 90 else 100 end
  from public.productos p where p.business_unit_id=b and p.activo and p.id <> '2c76d930-ad5a-4d25-92a5-13c665b1c56a'::uuid
    and (not p.maneja_stock or coalesce(p.stock,0)>0)
    and (not exists (select 1 from public.product_variants v where v.product_id=p.id)
      or exists (select 1 from public.product_variants v where v.product_id=p.id and v.is_active and (not v.manages_stock or coalesce(v.stock,0)>0)))
    and p.slug !~* 'prueba' and p.nombre !~* 'prueba'
  on conflict (season_id,product_id) do update set visible_web=true,visible_whatsapp=true,visible_instagram=true,available_to_remy=true,is_featured=excluded.is_featured,sort_order=excluded.sort_order;

  insert into public.season_variant_overrides (business_unit_id,season_id,variant_id,price_override,compare_at_price_override,is_active)
  select b,v_season_id,v.id,x.cyber,x.normal,true from public.product_variants v join (values
    ('LMV-PBALL-09',9900,11900),('LMV-PBALL-15',14900,19900),('LMV-PBALL-24',17900,23900),
    ('LMV-TRUFA-09',9900,11900),('LMV-TRUFA-15',14900,19900),('LMV-TRUFA-24',17900,23900),
    ('LMV-BOMB-09',9900,11900),('LMV-BOMB-15',14900,19900),('LMV-BOMB-24',17900,23900),
    ('LMV-ALF-HEMP-04',8900,11900),('LMV-DUBAI-120G',10900,10900),('LMV-DUBAI-240G',17900,22900),
    ('LMV-SUPERNOVA-110',10900,10900),('LMV-SUPERNOVA-230',17900,22900),
    ('LMV-TERREMOTO-120G',10900,10900),('LMV-TERREMOTO-240G',17900,22900),
    ('LMV-CYBER-DUO-120G',17900,21800),('LMV-BOX-CHOCO-80G',21900,21900)
  ) x(sku,cyber,normal) on x.sku=v.sku where v.business_unit_id=b
  on conflict (season_id,variant_id) do update set price_override=excluded.price_override,compare_at_price_override=excluded.compare_at_price_override,is_active=true;
end $$;
commit;
