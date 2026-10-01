# Limpieza de categorías y destacados públicos — 2026-10-01

## Alcance

- Se simplificó la navegación pública a cuatro categorías:
  - Proteínas veganas
  - Chocolatería y dulces
  - Pastelería
  - Empanadas y pizzas
- Se mantuvo sincronizado `productos.categoria` con `productos.category_id`.
- Se eliminó el recorte de las imágenes verticales en Destacados usando una relación 4:5 y `object-contain`.
- No se modificó Supabase administrado.

## Estado anterior

La base self-hosted contenía 12 categorías, incluidas variantes duplicadas o vacías. Los 15 productos activos tenían `category_id` nulo; Lomo Lyse y Postres en Frascos tampoco tenían nombre de categoría.

## Resultado en la base viva

| Categoría | Productos activos |
|---|---:|
| Proteínas veganas | 5 |
| Chocolatería y dulces | 6 |
| Pastelería | 3 |
| Empanadas y pizzas | 1 |

- Categorías vivas: 4.
- Productos activos sin `categoria` o `category_id`: 0.
- La fila inactiva `prueba` se conservó y se reasignó a `Empanadas y pizzas`; no fue publicada ni activada.

## Recuperación

Antes de la migración se generó un rollback exacto, root-only (`0600`):

`/opt/supabase-lamanito/audits/catalog-categories-20261001T185906Z/rollback.sql`

El directorio contiene además `SHA256SUMS`.

## Verificación

- Tests: 545 aprobados, 0 fallidos.
- Build Vercel Production: aprobado con Next.js 16.2.9.
- Despliegue: `dpl_HeSvhsCkNqfTmf4GJ6sTmC9C8o7G` (`READY`).
- Alias: `https://lamanitodelvegano.cl`.
- HTTP portada: 200.
- HTML de producción: contiene las cuatro categorías canónicas y no contiene las etiquetas antiguas.
- Captura de producción: las imágenes destacadas se ven completas, sin el recorte anterior.
- Logs de error del despliegue después de la verificación: ninguno.

## Nota de build local

La compilación local alcanzó compilación y TypeScript, pero el prerender local requiere las variables privadas de Supabase que no se guardan en el repositorio. El build remoto de Vercel, con su entorno de producción protegido, completó las 67 páginas correctamente.
