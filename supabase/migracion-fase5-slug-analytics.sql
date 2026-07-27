-- Migración: URL propia por producto (para campañas de ads personalizadas)
-- Ejecutar en el SQL Editor de Supabase. Segura de correr más de una vez.

alter table productos add column if not exists slug text;

-- Genera un slug a partir del nombre para los productos que ya existen y
-- todavía no tienen uno (minúsculas, sin tildes, espacios -> guiones).
-- Si dos productos generan el mismo slug, se les agrega un sufijo -2, -3...
-- para no chocar con la restricción unique de más abajo.
with base as (
  select
    id,
    regexp_replace(
      regexp_replace(
        lower(
          translate(nombre, 'áéíóúÁÉÍÓÚñÑ', 'aeiouAEIOUnN')
        ),
        '[^a-z0-9]+', '-', 'g'
      ),
      '(^-|-$)', '', 'g'
    ) as slug_base
  from productos
  where slug is null
),
numerado as (
  select
    id,
    slug_base,
    row_number() over (partition by slug_base order by id) as n
  from base
)
update productos p
set slug = case when numerado.n = 1 then numerado.slug_base else numerado.slug_base || '-' || numerado.n end
from numerado
where p.id = numerado.id;

create unique index if not exists productos_slug_key on productos (slug);

-- Meta Pixel y Google Analytics 4 — igual que el resto de integraciones,
-- configurables desde /admin/integraciones en vez de hardcodeadas en el
-- código. No son "secretas" en sentido estricto (van al navegador), pero
-- viven en la misma tabla por consistencia con el resto del panel.
alter table integraciones_secretas
  add column if not exists meta_pixel_id text,
  add column if not exists ga4_measurement_id text;
