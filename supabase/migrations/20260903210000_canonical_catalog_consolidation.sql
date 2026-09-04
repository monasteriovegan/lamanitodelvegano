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

-- 2. Ensure gluten_free and nut_free are false for non-certified products with gluten/wheat/nuts
update public.productos
set gluten_free = false,
    nut_free = false,
    updated_at = now()
where slug in (
  'empanada-del-18',
  'le-kostilles',
  'seitan-parrillero',
  'pack-parrillero-vegano-1',
  'pack-parrillero-vegano-2',
  'dulces-tipicos',
  'postres-en-frascos'
);

-- 3. Deactivate any test products
update public.productos
set activo = false,
    updated_at = now()
where slug ilike '%prueba%'
   or nombre ilike '%prueba%';
