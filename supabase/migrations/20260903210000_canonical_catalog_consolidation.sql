-- Canonical catalog consolidation migration
-- 1. Ensure all Fiestas Patrias products have synchronized visibility across all channels
update public.season_products sp
set visible_web = true,
    visible_whatsapp = true,
    visible_instagram = true,
    available_to_remy = true,
    updated_at = now()
from public.seasons s, public.productos p
where sp.season_id = s.id
  and sp.product_id = p.id
  and s.campaign_tag = 'fiestas-patrias-2026'
  and p.slug in (
    'empanada-del-18',
    'le-kostilles',
    'seitan-parrillero',
    'pack-parrillero-vegano-1',
    'pack-parrillero-vegano-2',
    'dulces-tipicos',
    'postres-en-frascos'
  );

-- 2. Ensure Pack Parrillero 1 & 2 have valid image_url for Meta Feed and Omnichannel consistency
update public.productos
set imagen_url = 'https://lamanitodelvegano.cl/campaigns/fiestas-patrias-2026/seitan-kostilles.webp',
    images = array['https://lamanitodelvegano.cl/campaigns/fiestas-patrias-2026/seitan-kostilles.webp'],
    updated_at = now()
where slug in ('pack-parrillero-vegano-1', 'pack-parrillero-vegano-2');

update public.product_variants
set image_url = 'https://lamanitodelvegano.cl/campaigns/fiestas-patrias-2026/seitan-kostilles.webp',
    updated_at = now()
where sku in ('FP26-PARR-01', 'FP26-PARR-02');

-- 3. Tri-state Dietary Semantics (true = verified, false = known non-compliant, null = unverified/no claim)
-- Known gluten/wheat/seitan-containing products: gluten_free = false, nut_free = null
update public.productos
set gluten_free = false,
    nut_free = null,
    updated_at = now()
where slug in (
  'empanada-del-18',
  'le-kostilles',
  'seitan-parrillero',
  'pack-parrillero-vegano-1',
  'pack-parrillero-vegano-2',
  'dulces-tipicos'
);

-- Postres en Frascos (varies by flavor/not certified globally): gluten_free = null, nut_free = null
update public.productos
set gluten_free = null,
    nut_free = null,
    updated_at = now()
where slug = 'postres-en-frascos';

-- 4. Deactivate any test products
update public.productos
set activo = false,
    updated_at = now()
where slug ilike '%prueba%'
   or nombre ilike '%prueba%';
