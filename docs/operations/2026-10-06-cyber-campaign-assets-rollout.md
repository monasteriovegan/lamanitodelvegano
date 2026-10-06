# Cyber Day Chocolatoso 2026 — assets y opciones de campaña

Fecha de preparación: 2026-10-06  
Rama: `codex/cyber-campaign-assets-2026`

## Alcance

- Los siete artes Cyber viven en `public/campaigns/cyber-day-chocolatoso-2026/`; no reemplazan `productos.imagen_url` ni `productos.images`.
- `season_products` contiene nombre, descripción, imagen, texto alternativo y slot de presentación temporales.
- Las barras configurables resuelven seis variantes canónicas: Dubái, Terremoto y Explosión de Supernova, cada una en 120 y 240 g.
- Brigadeiros/trufas, Protein Balls y bombones exigen una distribución exacta de 9, 15 o 24 unidades. Alfajores mantiene su pack Cyber de cuatro. Box conserva su elección simple.
- Las 18 ofertas explícitas conservan el precio publicado; el resto recibe 25% sin acumulación.
- La única fecha de entrega Cyber es 2026-10-10. La campaña cierra 2026-10-09 23:59:59 `America/Santiago`.

## Evidencia local

- `node --test test/cyber-pricing.test.ts test/cyber-migration.test.ts`: 8/8.
- `npm test`: 569/569, 0 fallos, 60.8 s.
- `npx tsc --noEmit`: correcto.
- ESLint sobre los archivos nuevos/modificados de componentes y DTO: correcto.
- El barrido amplio de lint conserva deuda anterior fuera del diff (`no-explicit-any` en `catalog-repository.ts`, `sync-dulces-catalog.ts` y el fixture histórico de migración); no se introdujeron errores en los archivos de aplicación modificados.
- `npm run build` con variables locales placeholder: correcto; Next.js compiló, validó TypeScript y generó la ruta dinámica `/cyber-day-chocolatoso-2026`.
- Las pruebas de contrato verifican `object-contain`, fallback de imagen de campaña a maestra, exactamente seis destacados, exclusión de `target_only`, CTA anclado y selección obligatoria antes de agregar barras.

La inspección visual con datos completos debe hacerse después de aplicar la migración en el self-hosted de producción o en un clon con esos datos. El build local no recibió acceso a producción y no se simuló catálogo para fabricar evidencia.

## Invariantes comprobados

- La migración de presentación se puede aplicar dos veces.
- Las imágenes maestras y los precios base son idénticos antes y después.
- `season_product_variant_targets` tiene RLS; `anon` y `authenticated` no pueden leerla; `service_role` sí.
- Un destino ajeno o una variante inactiva se omite del DTO.
- El carrito recibe `productId`, `variantId`, SKU y precio efectivos del destino elegido.
- Cantidad no positiva o stock insuficiente no agrega productos.

## Secuencia de publicación

1. Respaldar tablas afectadas.
2. Aplicar `20261006060525_cyber_campaign_presentation.sql` después de las migraciones Cyber existentes.
3. Desplegar el commit aprobado.
4. Verificar home y ruta Cyber en escritorio y móvil, sin finalizar checkout.
5. Confirmar 18 overrides, seis destacados, una oferta hero, dos targets ocultos y seis destinos de barras.

## Rollback

- Desactivar la temporada Cyber para retirar inmediatamente precios y presentación temporales.
- Revertir el deployment de aplicación si el problema es visual o de carrito.
- No restaurar imágenes ni precios maestros: esta implementación no los modifica.
- La tabla de destinos y columnas de presentación pueden permanecer sin afectar campañas inactivas; su eliminación requiere una migración explícita separada.
