# Cyber Campaign Assets and Options Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar los siete artes Cyber como presentación temporal, hacer comprables todas las opciones anunciadas y preservar intactos el catálogo maestro, sus imágenes y sus precios base.

**Architecture:** `seasons` y `season_products` controlarán hero, arte, texto y posición temporal; `season_variant_overrides` seguirá resolviendo precios; una tabla de destinos conectará la tarjeta agrupada de barras con seis variantes canónicas. El servidor entregará un DTO saneado y el carrito guardará siempre `productId`/`variantId` reales.

**Tech Stack:** Next.js 16.2.9, React 19.2.4, TypeScript, Supabase/PostgreSQL self-hosted, PGlite, Node test runner, Tailwind CSS 4.

**Spec:** `docs/superpowers/specs/2026-10-06-cyber-campaign-assets-and-options-design.md`

## Global Constraints

- La campaña usa `campaign_tag = 'cyber-day-chocolatoso-2026'`.
- Cierre: `2026-10-09T23:59:59-03:00`; entrega única: `2026-10-10`.
- Los 18 overrides explícitos ganan; sólo las variantes sin override reciben `Math.round(base * 0.75)`.
- Nunca escribir artes Cyber en `productos.imagen_url`, `productos.images` ni `product_variants.image_url`.
- No cambiar stock, pedidos, pagos, tracking, integraciones, Remy, WhatsApp, Instagram, Pixel ni CAPI.
- No crear pedidos, pagos, mensajes ni eventos Purchase reales durante verificación.
- Crear la migración nueva con `npx supabase migration new cyber_campaign_presentation`; no editar migraciones aplicadas.
- Toda tabla nueva debe tener RLS, escritura restringida y lectura del storefront por servidor.
- Implementar cada comportamiento con TDD y commits pequeños.

## Review Focus

- Asset ausente o corrupto: la tarjeta debe usar la foto maestra sin romper el catálogo (Task 5).
- Target de barra inactivo, ajeno al producto o sin stock: no debe agregarse al carrito (Tasks 3 y 4).
- Instantes límite antes y después de `2026-10-09T23:59:59-03:00`: los precios Cyber deben activarse y expirar exactamente (Task 6).
- Variante con override explícito: nunca debe recibir además el 25% (Tasks 2 y 6).
- Selección incompleta o excesiva de sabores: el botón debe permanecer bloqueado con mensaje preciso (Task 4).

---

### Task 1: Preparar los siete assets web de campaña

**Files:**
- Create: `public/campaigns/cyber-day-chocolatoso-2026/hero-duo-barras.webp`
- Create: `public/campaigns/cyber-day-chocolatoso-2026/brigadeiros-trufas.webp`
- Create: `public/campaigns/cyber-day-chocolatoso-2026/alfajores-canamo.webp`
- Create: `public/campaigns/cyber-day-chocolatoso-2026/protein-balls.webp`
- Create: `public/campaigns/cyber-day-chocolatoso-2026/box-chocolatosa.webp`
- Create: `public/campaigns/cyber-day-chocolatoso-2026/barras-configurables.webp`
- Create: `public/campaigns/cyber-day-chocolatoso-2026/bombones.webp`
- Create: `test/cyber-campaign-assets.test.ts`

**Interfaces:**
- Consumes: los siete PNG aprobados en `C:\Users\usuario\Downloads` listados en la especificación.
- Produces: siete rutas estables `/campaigns/cyber-day-chocolatoso-2026/*.webp` que usará la migración de Task 2.

- [ ] **Step 1: Escribir la prueba fallida de integridad de assets**

Crear pruebas `all seven Cyber campaign assets exist as WebP` y `campaign asset names are unique` que afirmen:

```ts
assert.equal(files.length, 7);
assert.deepEqual(files.sort(), expectedNames.sort());
assert.equal(header.subarray(0, 4).toString('ascii'), 'RIFF');
assert.equal(header.subarray(8, 12).toString('ascii'), 'WEBP');
assert.ok(statSync(path).size > 50_000);
```

- [ ] **Step 2: Ejecutar la prueba y comprobar que falla**

Run: `node --test test/cyber-campaign-assets.test.ts`  
Expected: FAIL porque los siete archivos todavía no existen.

- [ ] **Step 3: Convertir los PNG sin recortar**

Usar ImageMagick con `-strip -quality 88`, sin `-crop` ni `-resize`, siguiendo la matriz de la especificación:

```powershell
magick 'C:\Users\usuario\Downloads\Chocolate vegano_ Cyber Chocolatoso.png' -strip -quality 88 'public/campaigns/cyber-day-chocolatoso-2026/hero-duo-barras.webp'
magick 'C:\Users\usuario\Downloads\Cajita Vegana de Brigadeiros y Trufas.png' -strip -quality 88 'public/campaigns/cyber-day-chocolatoso-2026/brigadeiros-trufas.webp'
magick 'C:\Users\usuario\Downloads\Alfajores de Cáñamo_ Sabores Irresistibles.png' -strip -quality 88 'public/campaigns/cyber-day-chocolatoso-2026/alfajores-canamo.webp'
magick 'C:\Users\usuario\Downloads\Cyber Day de Chocolate Vegano.png' -strip -quality 88 'public/campaigns/cyber-day-chocolatoso-2026/protein-balls.webp'
magick 'C:\Users\usuario\Downloads\Caja Cyber Day de Chocolates Veganos.png' -strip -quality 88 'public/campaigns/cyber-day-chocolatoso-2026/box-chocolatosa.webp'
magick 'C:\Users\usuario\Downloads\Barra Terremoto_ Chocolate Vegano Artesanal.png' -strip -quality 88 'public/campaigns/cyber-day-chocolatoso-2026/barras-configurables.webp'
magick 'C:\Users\usuario\Downloads\Bombones Veganos Premium_ Seis Sabores.png' -strip -quality 88 'public/campaigns/cyber-day-chocolatoso-2026/bombones.webp'
```

Confirmar con `magick identify public/campaigns/cyber-day-chocolatoso-2026/*.webp` que los siete siguen midiendo `1122x1402`.

- [ ] **Step 4: Ejecutar la prueba de assets**

Run: `node --test test/cyber-campaign-assets.test.ts`  
Expected: 2 PASS, 0 FAIL.

- [ ] **Step 5: Revisar visualmente los siete WebP locales**

Abrir un contact sheet o cada archivo y confirmar que logos, precios, textos inferiores y llamadas “desliza” están completos.

- [ ] **Step 6: Commit**

```bash
git add public/campaigns/cyber-day-chocolatoso-2026 test/cyber-campaign-assets.test.ts
git commit -m "assets: add isolated Cyber campaign artwork"
```

### Task 2: Crear el esquema y seed transaccional de presentación Cyber

**Files:**
- Create: `supabase/migrations/*_cyber_campaign_presentation.sql` via Supabase CLI
- Modify: `test/fixtures/cyber-database.ts`
- Modify: `test/cyber-migration.test.ts`

**Interfaces:**
- Consumes: las siete rutas estables de Task 1 y los SKUs/precios fijados en la especificación.
- Produces: columnas `campaign_*`, `presentation_slot` y tabla `season_product_variant_targets` pobladas de forma idempotente.

- [ ] **Step 1: Ampliar primero el fixture y escribir pruebas de migración fallidas**

Agregar `CYBER_PRESENTATION_MIGRATION` y pruebas que, después de ejecutar las tres migraciones Cyber, afirmen:

```ts
assert.equal(featuredCount, 6);
assert.equal(heroOfferCount, 1);
assert.equal(targetOnlyCount, 2);
assert.equal(barTargetCount, 6);
assert.deepEqual(barTargetSkus.sort(), [
  'LMV-DUBAI-120G', 'LMV-DUBAI-240G',
  'LMV-TERREMOTO-120G', 'LMV-TERREMOTO-240G',
  'LMV-SUPERNOVA-110', 'LMV-SUPERNOVA-230',
].sort());
assert.equal(bombonFlavorCount, 6);
assert.deepEqual(bombonSelectionQuantities, [9, 15, 24]);
assert.deepEqual(optionMatrix, {
  'brigadeiros-trufas-surtidos': { flavors: 6, selections: [9, 15, 24] },
  'protein-balls': { flavors: 3, selections: [9, 15, 24] },
  'alfajores-canamo': { flavors: 4, selections: [4] },
  'box-chocolatosa': { flavors: 3, selections: [1] },
  'duo-barras-rellenas': { flavors: 2, selections: [2] },
});
assert.deepEqual(masterImagesAfter, masterImagesBefore);
assert.deepEqual(masterVariantPricesAfter, masterVariantPricesBefore);
```

Agregar una prueba de texto SQL que confirme `enable row level security`, ausencia de cualquier grant a `anon`/`authenticated` y grant administrativo a `service_role`.

- [ ] **Step 2: Ejecutar las pruebas y comprobar que fallan**

Run: `node --test test/cyber-migration.test.ts`  
Expected: FAIL por ausencia de la migración y de las columnas/tablas nuevas.

- [ ] **Step 3: Crear la migración con Supabase CLI**

Run: `npx supabase migration new cyber_campaign_presentation`  
Expected: un único archivo nuevo bajo `supabase/migrations/`; guardar su ruta en `CYBER_PRESENTATION_MIGRATION`.

- [ ] **Step 4: Implementar esquema, seguridad y precondiciones**

La migración debe:

- agregar `campaign_name text`, `campaign_description text`, `campaign_image_url text`, `campaign_alt_text text` y `presentation_slot text not null default 'catalog'`, con check limitado a `hero_offer`, `featured`, `catalog`, `target_only`;
- crear `season_product_variant_targets` con FKs, unicidad e índice descritos en la especificación;
- habilitar RLS y restringir escritura a `service_role`;
- validar que los seis targets pertenecen a la misma unidad y que cada variante pertenece a su producto;
- abortar la transacción si falta una precondición.

- [ ] **Step 5: Sembrar presentación, slots, destinos y bombones**

Asignar exactamente un `hero_offer`, seis `featured`, dos barras auxiliares `target_only` y `catalog` al resto. Poblar los seis destinos de barras y el grupo `sabores` de bombones con cantidades 9/15/24 y estos valores exactos:

1. `te-chai`: Ganache cremoso de té chai.
2. `naranja-jengibre-maracuya`: Compota de naranja, jengibre y trufa bitter de maracuyá.
3. `manzana-choco-canela`: Manzana confitada y ganache choco-canela.
4. `caramelo-snickers`: Caramelo salado estilo Snickers.
5. `frutos-rojos-chocolate-55`: Confitura de frutos rojos y ganache de chocolate 55%.
6. `mokkachino-whisky`: Mokkachino Whisky.

No ejecutar `update` sobre imágenes o precios maestros.

- [ ] **Step 6: Ejecutar la migración dos veces en PGlite**

Run: `node --test test/cyber-migration.test.ts`  
Expected: PASS; los conteos permanecen iguales tras la segunda ejecución.

- [ ] **Step 7: Ejecutar pruebas Cyber relacionadas**

Run: `node --test test/cyber-migration.test.ts test/cyber-pricing.test.ts test/dulces-chocolateria-catalog.test.ts`  
Expected: todas PASS.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations test/fixtures/cyber-database.ts test/cyber-migration.test.ts
git commit -m "feat: add isolated Cyber campaign presentation schema"
```

### Task 3: Exponer presentación y destinos mediante tipos y DTO saneado

**Files:**
- Modify: `src/lib/catalog/types.ts:84-101`
- Modify: `src/lib/catalog/catalog-data.ts:16-67`
- Modify: `src/lib/catalog/public-dto.ts:52-71`
- Create: `test/cyber-campaign-presentation.test.ts`

**Interfaces:**
- Consumes: filas de `season_products` y `season_product_variant_targets` creadas en Task 2.
- Produces: `CatalogPresentationSlot`, `CatalogCampaignPurchaseTarget`, campos `campaign*`, `presentationSlot` y `purchaseTargets` en `CatalogCampaignProduct` y `PublicCatalogCampaign`.

- [ ] **Step 1: Escribir las pruebas fallidas de tipos/DTO**

Crear pruebas `public campaign DTO keeps master and campaign media separate` y `invalid or foreign purchase targets are omitted` con estas aserciones:

```ts
assert.equal(dto.products[0].imageUrl, '/products/barra-terremoto.jpg');
assert.equal(dto.products[0].campaignImageUrl, '/campaigns/cyber-day-chocolatoso-2026/barras-configurables.webp');
assert.equal(dto.products[0].presentationSlot, 'featured');
assert.equal(dto.products[0].purchaseTargets.length, 6);
assert.ok(dto.products[0].purchaseTargets.every((target) => target.productId && target.variantId));
assert.equal(dto.products[0].purchaseTargets.some((target) => target.variantId === 'foreign-variant'), false);
```

- [ ] **Step 2: Ejecutar la prueba y comprobar que falla**

Run: `node --test test/cyber-campaign-presentation.test.ts`  
Expected: FAIL porque los tipos y el DTO no contienen presentación ni targets.

- [ ] **Step 3: Definir interfaces exactas**

En `types.ts` definir:

```ts
export type CatalogPresentationSlot = 'hero_offer' | 'featured' | 'catalog' | 'target_only';
export interface CatalogCampaignPurchaseTarget {
  id: string; productId: string; productName: string;
  variantId: string; variantSku: string;
  groupLabel: string; optionLabel: string; sortOrder: number;
  price: number; compareAtPrice: number | null;
  managesStock: boolean; stock: number | null;
}
```

Extender `CatalogCampaignProduct` con `campaignName`, `campaignDescription`, `campaignImageUrl`, `campaignAltText`, `presentationSlot` y `purchaseTargets`.

- [ ] **Step 4: Ampliar `loadCatalogCampaign`**

Seleccionar los nuevos campos, consultar targets por `season_id`, validar pertenencia producto/variante con el `productById` canónico y resolver el precio efectivo desde esa variante. Ordenar targets por `sort_order`; omitir targets inconsistentes, inactivos o ajenos.

- [ ] **Step 5: Sanear el DTO público**

`toPublicCatalogCampaign(campaign: CatalogCampaign)` debe copiar sólo los campos de presentación y target declarados en la interfaz; no exponer `business_unit_id` ni filas crudas.

- [ ] **Step 6: Ejecutar pruebas unitarias y de API de campaña**

Run: `node --test test/cyber-campaign-presentation.test.ts test/canonical-catalog-omnichannel.test.ts`  
Expected: todas PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/catalog/types.ts src/lib/catalog/catalog-data.ts src/lib/catalog/public-dto.ts test/cyber-campaign-presentation.test.ts
git commit -m "feat: expose Cyber campaign presentation targets"
```

### Task 4: Hacer comprables los targets reales y las opciones de sabores

**Files:**
- Modify: `src/lib/catalog/catalog-cart.ts`
- Create: `src/components/tienda/CampaignProductCard.tsx`
- Create: `src/components/tienda/CampaignTargetCard.tsx`
- Modify: `src/components/tienda/CampaignCatalog.tsx`
- Create: `test/cyber-campaign-cart.test.ts`
- Modify: `test/checkout-options-flow-regression.test.ts`

**Interfaces:**
- Consumes: `PublicCatalogCampaign`, `PublicCatalogProduct` y targets públicos de Task 3.
- Produces: `toCampaignTargetCartItem(...)` y tarjetas que agregan IDs/SKUs canónicos.

- [ ] **Step 1: Escribir pruebas fallidas del carrito target**

Definir la firma:

```ts
export function toCampaignTargetCartItem(
  displayName: string,
  target: PublicCatalogCampaign['products'][number]['purchaseTargets'][number],
  quantity: number,
  campaignTag: string,
): CatalogCartItem | null;
```

Las pruebas deben afirmar:

```ts
assert.equal(item?.productoId, 'product-dubai');
assert.equal(item?.variantId, 'variant-dubai-240');
assert.equal(item?.variantSku, 'LMV-DUBAI-240G');
assert.equal(item?.precio, 17900);
assert.equal(item?.campaignTag, 'cyber-day-chocolatoso-2026');
assert.equal(toCampaignTargetCartItem('Barra Cyber', outOfStockTarget, 1, tag), null);
assert.equal(toCampaignTargetCartItem('Barra Cyber', activeTarget, 0, tag), null);
```

Agregar casos de selección de sabores que exijan 9/15/24 y rechacen total menor o mayor.

- [ ] **Step 2: Ejecutar las pruebas y comprobar que fallan**

Run: `node --test test/cyber-campaign-cart.test.ts test/checkout-options-flow-regression.test.ts`  
Expected: FAIL por helper y comportamientos aún ausentes.

- [ ] **Step 3: Implementar `toCampaignTargetCartItem`**

Devolver `null` para cantidad no positiva o stock insuficiente. Para un target válido, usar IDs, SKU, nombre del producto destino, precio efectivo y formato `${groupLabel} · ${optionLabel}`.

- [ ] **Step 4: Extraer `CampaignProductCard` sin cambiar su contrato canónico**

Mover la tarjeta existente y cambiar su imagen/título/descripción a fallback:

```ts
export function CampaignProductCard(props: {
  product: PublicCatalogCampaign['products'][number];
  campaignTag: string;
}): React.JSX.Element | null;

const image = product.campaignImageUrl || product.imageUrl;
const name = product.campaignName || product.name;
const description = product.campaignDescription || product.description;
```

Conservar `evaluateOptionSelection`, `selectionQuantity * quantity`, mensajes de faltantes, stock y tracking.

- [ ] **Step 5: Implementar `CampaignTargetCard`**

Firma:

```ts
export function CampaignTargetCard(props: {
  product: PublicCatalogCampaign['products'][number];
  campaignTag: string;
}): React.JSX.Element | null;
```

Iniciar sin target seleccionado; agrupar visualmente por `groupLabel`, mostrar `optionLabel`, precio y precio anterior. Habilitar “Agregar al carrito” sólo tras seleccionar un target con stock y usar `toCampaignTargetCartItem`.

- [ ] **Step 6: Convertir `CampaignCatalog` en orquestador**

Renderizar `CampaignTargetCard` cuando `purchaseTargets.length > 0`; en otro caso `CampaignProductCard`. Asignar `id={`offer-${product.slug}`}` al contenedor para enlaces del hero/home.

- [ ] **Step 7: Agregar prueba de contrato UI**

La prueba debe afirmar que target inicia vacío, el botón está disabled sin elección, la foto usa fallback de campaña a maestra y no existe una asignación fija a `barra-terremoto` al agregar.

- [ ] **Step 8: Ejecutar pruebas de carrito y opciones**

Run: `node --test test/cyber-campaign-cart.test.ts test/checkout-options-flow-regression.test.ts test/storefront-option-selection.test.ts test/catalog-cart.test.ts`  
Expected: todas PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/catalog/catalog-cart.ts src/components/tienda/CampaignProductCard.tsx src/components/tienda/CampaignTargetCard.tsx src/components/tienda/CampaignCatalog.tsx test/cyber-campaign-cart.test.ts test/checkout-options-flow-regression.test.ts
git commit -m "feat: make Cyber campaign options canonical and purchasable"
```

### Task 5: Componer hero, seis destacados y resto del catálogo sin recortes

**Files:**
- Create: `src/components/tienda/CampaignFeaturedGrid.tsx`
- Modify: `src/components/layout/Hero.tsx:6-23`
- Modify: `src/app/page.tsx:16-76`
- Modify: `src/app/cyber-day-chocolatoso-2026/page.tsx:14-35`
- Modify: `test/admin-image-upload-season-banner.test.ts`
- Create: `test/cyber-campaign-page.test.ts`

**Interfaces:**
- Consumes: slots, presentación y tarjetas de Tasks 3-4.
- Produces: home y página Cyber con una oferta hero, seis destacados, targets ocultos y resto 25%.

- [ ] **Step 1: Escribir pruebas fallidas de composición**

Probar que:

```ts
assert.match(home, /CampaignFeaturedGrid/);
assert.doesNotMatch(home, /cyberFeaturedIds/);
assert.match(cyberPage, /presentationSlot === 'hero_offer'/);
assert.match(cyberPage, /presentationSlot === 'featured'/);
assert.match(cyberPage, /presentationSlot === 'catalog'/);
assert.match(cyberPage, /presentationSlot !== 'target_only'/);
assert.match(cardSource, /campaignImageUrl\s*\|\|\s*product\.imageUrl/);
assert.match(cardSource, /object-contain/);
```

- [ ] **Step 2: Ejecutar las pruebas y comprobar que fallan**

Run: `node --test test/cyber-campaign-page.test.ts test/admin-image-upload-season-banner.test.ts`  
Expected: FAIL porque home aún recompone destacados desde `productos` y no existen slots.

- [ ] **Step 3: Crear `CampaignFeaturedGrid`**

Firma:

```ts
export function CampaignFeaturedGrid(props: {
  products: PublicCatalogCampaign['products'];
}): React.JSX.Element;
```

Renderizar exactamente los recibidos, con `campaignImageUrl || imageUrl`, `object-contain` y enlace `/cyber-day-chocolatoso-2026#offer-${slug}`.

- [ ] **Step 4: Actualizar home**

Eliminar la recomposición por IDs sobre `productos`. Convertir `cyber` con `toPublicCatalogCampaign`, filtrar `presentationSlot === 'featured'` y pasar el resultado a `CampaignFeaturedGrid`. Mantener `CatalogoGrid` con `productos` maestros y precios efectivos.

- [ ] **Step 5: Actualizar hero**

Conservar `cyber.bannerImage`, usar `object-contain`, alt descriptivo y CTA hacia `/cyber-day-chocolatoso-2026#offer-duo-barras-rellenas`.

- [ ] **Step 6: Actualizar la página Cyber**

Separar `hero_offer`, `featured`, `catalog` y omitir `target_only`. Renderizar el hero offer primero, seis destacados después y sólo los productos `catalog` bajo “25% de descuento”.

- [ ] **Step 7: Ejecutar pruebas de página y media**

Run: `node --test test/cyber-campaign-page.test.ts test/admin-image-upload-season-banner.test.ts test/storage-media-fallback.test.ts`  
Expected: todas PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/tienda/CampaignFeaturedGrid.tsx src/components/layout/Hero.tsx src/app/page.tsx src/app/cyber-day-chocolatoso-2026/page.tsx test/admin-image-upload-season-banner.test.ts test/cyber-campaign-page.test.ts
git commit -m "feat: render isolated Cyber campaign presentation"
```

### Task 6: Fijar límites de precio, ejecutar verificación completa y documentar evidencia local

**Files:**
- Modify: `test/cyber-pricing.test.ts`
- Modify: `test/cyber-migration.test.ts`
- Create: `docs/operations/2026-10-06-cyber-campaign-assets-rollout.md`

**Interfaces:**
- Consumes: implementación completa de Tasks 1-5.
- Produces: cobertura de límites y evidencia de que la rama está lista para producción.

- [ ] **Step 1: Agregar pruebas fallidas de límite e invariantes**

Fijar casos:

```ts
assert.equal(cyberIsActive(campaign, new Date('2026-10-09T23:59:59-03:00')), true);
assert.equal(cyberIsActive(campaign, new Date('2026-10-10T00:00:00-03:00')), false);
assert.equal(explicitOverride.price, 9900);
assert.notEqual(explicitOverride.price, Math.round(9900 * 0.75));
assert.equal(genericVariant.price, Math.round(genericBase * 0.75));
assert.deepEqual(masterAfter, masterBefore);
```

- [ ] **Step 2: Ejecutar las pruebas y corregir sólo si revelan un fallo**

Run: `node --test test/cyber-pricing.test.ts test/cyber-migration.test.ts`  
Expected: PASS después de alinear cualquier borde con `ends_at` exacto.

- [ ] **Step 3: Ejecutar toda la suite**

Run: `npm test`  
Expected: 0 FAIL; registrar total y duración.

- [ ] **Step 4: Ejecutar análisis estático**

Run: `npx eslint src/lib/catalog src/components/tienda src/components/layout/Hero.tsx src/app/page.tsx src/app/cyber-day-chocolatoso-2026/page.tsx test/cyber-*.test.ts`  
Expected: exit 0.  
Run: `npm run lint`  
Expected: registrar la línea base completa y confirmar que no aparecen errores atribuibles al diff.  
Run: `npx tsc --noEmit`  
Expected: exit 0.

- [ ] **Step 5: Ejecutar build de producción**

Run en PowerShell:

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL='http://127.0.0.1:54321'
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY='local-build-placeholder'
$env:SUPABASE_SERVICE_ROLE_KEY='local-build-placeholder'
$env:NEXT_PUBLIC_SITE_URL='http://127.0.0.1:3000'
npm run build
```

Expected: build Next.js exitoso y rutas Cyber generadas sin error.

- [ ] **Step 6: Verificar visualmente en servidor local**

Abrir home y `/cyber-day-chocolatoso-2026` a 1440×900 y 390Ø44. Confirmar siete artes completos, seis tarjetas, controles de 44 px, ausencia de overflow, selección de barras y sabores, carrito correcto y fecha única; no finalizar checkout.

- [ ] **Step 7: Escribir evidencia local y rollback**

Documentar commits, comandos/resultados, matriz de precios, capturas, invariantes y rollback por desactivación de temporada/deployment. No incluir secretos.

- [ ] **Step 8: Commit**

```bash
git add test/cyber-pricing.test.ts test/cyber-migration.test.ts docs/operations/2026-10-06-cyber-campaign-assets-rollout.md
git commit -m "test: verify Cyber campaign isolation end to end"
```

### Task 7: Revisar, integrar y desplegar con respaldo en producción

**Files:**
- Modify: `docs/operations/2026-10-06-cyber-campaign-assets-rollout.md`

**Interfaces:**
- Consumes: rama aprobada, migración nueva, siete assets y evidencia local.
- Produces: producción verificada y registro final sin secretos.

- [ ] **Step 1: Ejecutar revisión final de rama**

Comparar contra `origin/main`, confirmar que no hay cambios en integraciones/automatizaciones y que ninguna migración aplicada fue editada. Resolver hallazgos antes de continuar.

- [ ] **Step 2: Publicar rama, abrir PR y exigir CI verde**

El PR debe contener la especificación, este plan, commits de Tasks 1-6 y evidencia local. No integrar con tests o build fallidos.

- [ ] **Step 3: Capturar baseline productivo read-only**

Usar `ssh lmv-vps` como `supabaseops`. Registrar, sin secretos: health de `supabase-db`, conteos/hashes de imágenes maestras y precios base afectados, stock agregado, pedidos y tracking, estado de temporada, overrides y opciones.

- [ ] **Step 4: Respaldar tablas afectadas**

Crear un directorio fechado bajo `/opt/supabase-lamanito/audits/` y respaldar `productos`, `product_variants`, `product_option_groups`, `product_option_values`, `seasons`, `season_products` y `season_variant_overrides`. Verificar checksums y permisos sin imprimir credenciales. La tabla nueva aún no existe en este punto y no forma parte del backup previo.

- [ ] **Step 5: Aplicar la migración transaccional en Supabase self-hosted**

Ejecutar sólo el archivo nuevo contra el contenedor/servicio de PostgreSQL productivo ya identificado. Si `sudo` pide contraseña, detenerse para ingreso local del usuario. Abortar ante cualquier precondición fallida.

- [ ] **Step 6: Verificar datos antes del deploy web**

Confirmar seis `featured`, un `hero_offer`, seis targets de barra, seis sabores de bombones, 18 overrides, fecha/cierre correctos y hashes maestros sin cambios. Si falla un invariante, restaurar desde backup y no desplegar.

Guardar además un dump posterior de `season_product_variant_targets` dentro del mismo directorio de auditoría para facilitar el rollback de la presentación nueva.

- [ ] **Step 7: Integrar y desplegar el código aprobado**

Integrar el PR sólo con CI verde y desplegar el commit exacto que contiene la migración/assets. Confirmar dominio `https://lamanitodelvegano.cl` y healthchecks; no reiniciar el VPS completo.

- [ ] **Step 8: Verificar producción sin compra real**

En escritorio y móvil comprobar hero, seis tarjetas, catálogo 25%, barras 3×2, bombones 9/15/24, demás sabores, carrito, stock visual y fecha única. Detenerse antes de crear pedido o abrir pago.

- [ ] **Step 9: Revisar logs e invariantes posteriores**

Confirmar ausencia de errores de imagen/API/checkout, estado saludable del servicio y mismos conteos/hashes de stock, pedidos y tracking. Confirmar que Remy y canales no cambiaron.

- [ ] **Step 10: Completar y versionar el informe final**

Agregar URLs, commit/deployment, timestamps, comandos sanitizados, resultados, capturas y ubicación del backup al documento de rollout.

```bash
git add docs/operations/2026-10-06-cyber-campaign-assets-rollout.md
git commit -m "docs: record Cyber campaign production rollout"
```
