# Fiestas Patrias 2026 Catalog Master Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrar siete ofertas de Fiestas Patrias 2026 en un catálogo normalizado de Supabase consumido por web, carrito, checkout, pedidos, Remy y el feed Meta.

**Architecture:** El sistema conserva `productos` como entidad comercial y agrega relaciones normalizadas para variantes, opciones y packs. Un `CatalogRepository` entrega un DTO único a todos los consumidores; el checkout resuelve precios y selecciones otra vez desde Supabase. `seasons` controla campaña y visibilidad por canal, y Meta recibe una proyección de solo lectura.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Node test runner, Supabase/Postgres 17, Vercel, Meta Graph API.

**Spec:** `docs/superpowers/specs/2026-09-01-fiestas-patrias-catalog-master-design.md`

## Global Constraints

- No eliminar datos, pedidos, conversaciones, clientes, columnas antiguas ni integraciones.
- Preservar todos los cambios locales previos y no incluirlos accidentalmente en commits.
- `business_unit_id` debe filtrar cada lectura y escritura del catálogo.
- Supabase es la única fuente de verdad para precios y disponibilidad.
- Mantener WhatsApp e Instagram en `read_only`; no habilitar outbound automático.
- `campaign_tag` debe ser exactamente `fiestas-patrias-2026`.
- No generar imágenes ni asignar assets engañosos a Pack Parrillero 1/2.
- No generar compras ni eventos Purchase falsos.
- Toda tabla nueva en `public` tendrá RLS, grants mínimos e índices de foreign keys.

---

### Task 1: Contrato puro de selección y precios

**Files:**
- Create: `src/lib/catalog/types.ts`
- Create: `src/lib/catalog/selection.ts`
- Test: `test/catalog-selection.test.ts`

**Interfaces:**
- Produces: `CatalogProduct`, `CatalogVariant`, `CatalogOptionGroup`, `CatalogSelection`, `resolveCatalogLine(input)`.
- `resolveCatalogLine` recibe un producto canónico y una intención sin precio; devuelve una línea con precio tomado de la variante o un error estable.

- [ ] **Step 1: Escribir pruebas fallidas de selección**

```ts
test('acepta diez empanadas del mismo sabor', () => {
  const result = resolveCatalogLine(empanadaFixture, {
    productId: 'empanada', variantId: 'pack-10', quantity: 1,
    selections: [{ optionValueId: 'pino-seitan', quantity: 10 }],
  });
  assert.equal(result.ok, true);
  assert.equal(result.line?.unitPrice, 23900);
});

test('rechaza un pack de diez cuya selección suma nueve', () => {
  const result = resolveCatalogLine(empanadaFixture, {
    productId: 'empanada', variantId: 'pack-10', quantity: 1,
    selections: [{ optionValueId: 'pino-seitan', quantity: 5 }, { optionValueId: 'napolitana', quantity: 4 }],
  });
  assert.deepEqual(result, { ok: false, error: 'selection_quantity_mismatch' });
});

test('ignora cualquier precio enviado por el cliente', () => {
  const result = resolveCatalogLine(seitanFixture, {
    productId: 'seitan', variantId: '1kg', quantity: 1, clientPrice: 1,
  });
  assert.equal(result.line?.unitPrice, 9900);
});
```

- [ ] **Step 2: Ejecutar RED**

Run: `node --test test/catalog-selection.test.ts`
Expected: FAIL porque `src/lib/catalog/selection.ts` no existe.

- [ ] **Step 3: Implementar tipos y resolución mínima**

```ts
export function resolveCatalogLine(product: CatalogProduct, input: CatalogLineIntent): CatalogLineResult {
  const variant = product.variants.find((item) => item.id === input.variantId && item.isActive);
  if (!variant) return { ok: false, error: 'variant_not_available' };
  const total = (input.selections || []).reduce((sum, item) => sum + item.quantity, 0);
  if (variant.selectionQuantity !== total) return { ok: false, error: 'selection_quantity_mismatch' };
  return { ok: true, line: { productId: product.id, variantId: variant.id, unitPrice: variant.price, quantity: input.quantity, selections: input.selections || [] } };
}
```

- [ ] **Step 4: Ejecutar GREEN y casos 5+5, combinación múltiple, 3 iguales, 2+1 y opción single**

Run: `node --test test/catalog-selection.test.ts`
Expected: PASS sin warnings.

- [ ] **Step 5: Commit aislado**

```bash
git add src/lib/catalog/types.ts src/lib/catalog/selection.ts test/catalog-selection.test.ts
git commit -m "feat: validate canonical catalog selections"
```

### Task 2: Migración normalizada y repositorio canónico

**Files:**
- Create: `supabase/migrations/<generated>_fiestas_patrias_catalog_master.sql`
- Create: `src/lib/catalog/catalog-repository.ts`
- Modify: `src/lib/data/catalogo.ts`
- Modify: `src/types/domain.ts`
- Test: `test/catalog-repository.test.ts`

**Interfaces:**
- Consumes: tipos de Task 1.
- Produces: `CatalogRepository.listActive`, `getById`, `getBySlug`, `getCampaign`.

- [ ] **Step 1: Crear la migración mediante Supabase CLI**

Run: `npx supabase migration new fiestas_patrias_catalog_master`

- [ ] **Step 2: Escribir prueba fallida del mapeo del repositorio**

```ts
test('mapea variantes, opciones y componentes sin cruzar business units', async () => {
  const catalog = await repository.getBySlug('f3b57ce7-0796-40e5-94f1-07cb2b48ba85', 'empanada-del-18');
  assert.equal(catalog?.variants.length, 2);
  assert.equal(catalog?.optionGroups[0].values.length, 6);
  assert.equal(catalog?.businessUnitId, 'f3b57ce7-0796-40e5-94f1-07cb2b48ba85');
});
```

- [ ] **Step 3: Ejecutar RED**

Run: `node --test test/catalog-repository.test.ts`
Expected: FAIL porque el repositorio no existe.

- [ ] **Step 4: Implementar migración aditiva**

Crear `product_variants`, `product_option_groups`, `product_option_values` y `product_pack_components`; extender `seasons` y `season_products`; agregar constraints, índices, RLS y grants explícitos. No eliminar campos legado.

- [ ] **Step 5: Implementar repositorio con carga relacional y fallback legado**

La consulta filtra `business_unit_id` y `activo`, ordena relaciones por `sort_order` y solo invoca `parseFormatos`/`parseVariedades` cuando no hay filas normalizadas.

- [ ] **Step 6: Ejecutar GREEN**

Run: `node --test test/catalog-repository.test.ts test/catalog-selection.test.ts`
Expected: PASS.

- [ ] **Step 7: Aplicar migración y verificar schema real**

Usar Supabase `apply_migration`; luego consultar `information_schema`, constraints, RLS, policies e índices. Ejecutar advisors y corregir hallazgos relacionados.

- [ ] **Step 8: Commit aislado**

```bash
git add supabase/migrations src/lib/catalog/catalog-repository.ts src/lib/data/catalogo.ts src/types/domain.ts test/catalog-repository.test.ts
git commit -m "feat: add normalized catalog master schema"
```

### Task 3: Datos oficiales, assets y temporada

**Files:**
- Create: `supabase/migrations/<generated>_seed_fiestas_patrias_2026.sql`
- Create: `docs/operations/2026-09-01-fiestas-patrias-asset-map.md`
- Test: `test/fiestas-patrias-catalog.test.ts`

**Interfaces:**
- Produces siete productos canónicos, variantes, opciones, packs y la temporada `fiestas-patrias-2026`.

- [ ] **Step 1: Escribir prueba de contrato con los valores literales autorizados**

```ts
test('la campaña expone seis ofertas principales y conserva Dulces Típicos controlable', async () => {
  const campaign = await loadCampaignFixture();
  assert.equal(campaign.campaignTag, 'fiestas-patrias-2026');
  assert.equal(campaign.products.filter((p) => p.visibleWeb).length, 6);
  assert.equal(campaign.products.find((p) => p.slug === 'dulces-tipicos')?.active, true);
  assert.equal(campaign.products.find((p) => p.slug === 'dulces-tipicos')?.visibleWeb, false);
});
```

- [ ] **Step 2: Ejecutar RED**

Run: `node --test test/fiestas-patrias-catalog.test.ts`
Expected: FAIL porque la campaña aún no existe.

- [ ] **Step 3: Subir assets sin exponer credenciales**

Rutas estables:

```text
campaigns/fiestas-patrias-2026/empanada-del-18.png
campaigns/fiestas-patrias-2026/postres-en-frascos.png
campaigns/fiestas-patrias-2026/seitan-kostilles.png
campaigns/fiestas-patrias-2026/dulces-tipicos.png
```

- [ ] **Step 4: Escribir seed idempotente**

Reutilizar IDs de `Seitan de la Manito` y `Le Kostilles`; hacer upsert por `(business_unit_id, slug)`/SKU; no asociar imagen falsa a packs; registrar fechas `2026-09-12`, `2026-09-15`, `2026-09-16`.

- [ ] **Step 5: Aplicar seed y verificar filas reales**

Consultar productos, variantes, opciones, componentes y temporada; comprobar siete slugs y unicidad de SKU.

- [ ] **Step 6: Ejecutar GREEN**

Run: `node --test test/fiestas-patrias-catalog.test.ts`
Expected: PASS usando la representación canónica.

- [ ] **Step 7: Commit aislado**

```bash
git add supabase/migrations docs/operations/2026-09-01-fiestas-patrias-asset-map.md test/fiestas-patrias-catalog.test.ts
git commit -m "feat: seed Fiestas Patrias 2026 catalog"
```

### Task 4: API, landing y carrito

**Files:**
- Create: `src/app/api/catalog/products/route.ts`
- Create: `src/app/api/catalog/products/[slug]/route.ts`
- Create: `src/app/api/catalog/campaigns/[tag]/route.ts`
- Create: `src/app/fiestas-patrias-2026/page.tsx`
- Create: `src/components/tienda/CampaignCatalog.tsx`
- Create: `src/components/tienda/OptionQuantitySelector.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/components/tienda/ProductPurchasePanel.tsx`
- Modify: `src/lib/cart/CartContext.tsx`
- Test: `test/catalog-api.test.ts`
- Test: `test/catalog-cart.test.ts`

**Interfaces:**
- API devuelve únicamente DTO público y nunca costos internos.
- Carrito persiste `variantId`, `variantSku` y `selections` además de campos legado.

- [ ] **Step 1: Escribir pruebas fallidas de DTO público y serialización del carrito**

```ts
test('el carrito conserva 5+3+2 empanadas con variantId estable', () => {
  const item = toCartItem(resolvedEmpanadaLine);
  assert.deepEqual(item.selections.map((s) => s.quantity), [5, 3, 2]);
  assert.equal(item.variantId, 'pack-10');
});
```

- [ ] **Step 2: Ejecutar RED**

Run: `node --test test/catalog-api.test.ts test/catalog-cart.test.ts`
Expected: FAIL por APIs/componentes ausentes.

- [ ] **Step 3: Implementar APIs, landing responsive, sección de portada y selectores**

La suma debe actualizarse en pantalla y el CTA permanecer deshabilitado hasta alcanzar exactamente `selectionQuantity`.

- [ ] **Step 4: Ejecutar GREEN, lint focalizado y verificación browser local**

Run: `node --test test/catalog-api.test.ts test/catalog-cart.test.ts`
Run: `npx eslint src/app/api/catalog src/app/fiestas-patrias-2026 src/components/tienda src/lib/cart/CartContext.tsx`

- [ ] **Step 5: Commit aislado**

```bash
git add src/app/api/catalog src/app/fiestas-patrias-2026 src/app/page.tsx src/components/tienda src/lib/cart/CartContext.tsx test/catalog-api.test.ts test/catalog-cart.test.ts
git commit -m "feat: expose Fiestas Patrias catalog storefront"
```

### Task 5: Checkout y pedidos con detalle completo

**Files:**
- Modify: `src/types/domain.ts`
- Modify: `src/lib/pricing/calcular-pedido.ts`
- Modify: `src/app/checkout/page.tsx`
- Modify: `src/lib/ai/remy-commerce.ts`
- Test: `test/catalog-checkout.test.ts`

**Interfaces:**
- `CheckoutRequest.items[]` acepta `variantId` y `selections`; no acepta un precio confiable.
- `calcularPedido` llama al resolvedor canónico y devuelve líneas completas para `pedidos.items`.

- [ ] **Step 1: Escribir pruebas fallidas de seguridad y persistencia**

```ts
test('checkout recalcula $23.900 aunque el frontend intente enviar $1', async () => {
  const result = await calculateCatalogCheckout({ variantId: pack10Id, clientPrice: 1, selections: tenPino });
  assert.equal(result.itemsResueltos?.[0].precio, 23900);
});

test('pedido conserva nombres y cantidades de todas las opciones', async () => {
  const line = await calculateCatalogCheckout({ variantId: pack10Id, selections: fiveThreeTwo });
  assert.deepEqual(line.itemsResueltos?.[0].selections?.map((s) => [s.label, s.quantity]), [['Pino de seitán', 5], ['Napolitana', 3], ['Champiñón + queso vegano', 2]]);
});
```

- [ ] **Step 2: Ejecutar RED**

Run: `node --test test/catalog-checkout.test.ts`

- [ ] **Step 3: Implementar resolución server-side y compatibilidad legado**

Los items antiguos sin `variantId` siguen usando `parseFormatos`; los nuevos requieren variante válida y opciones exactas.

- [ ] **Step 4: Ejecutar GREEN y tests de checkout existentes**

Run: `node --test test/catalog-checkout.test.ts test/repositories.test.ts test/tracking.test.ts`

- [ ] **Step 5: Commit aislado sin absorber el diff previo de atribución**

Usar staging interactivo o parches de índice para separar exclusivamente las líneas nuevas de catálogo en archivos ya modificados.

### Task 6: Remy y canales read-only

**Files:**
- Modify: `src/lib/ai/remy-commerce.ts`
- Modify: `src/lib/ai/remy.ts`
- Modify: `src/lib/wonka/tools.ts`
- Test: `test/catalog-remy.test.ts`

**Interfaces:**
- `catalog_search` y `catalog_get` devuelven campaña, variantes, opciones y componentes desde `CatalogRepository`.
- `cart_add` recibe `variantId` y selecciones cuantitativas.

- [ ] **Step 1: Escribir pruebas fallidas para las preguntas comerciales requeridas**

```ts
test('Remy obtiene el precio del seitán de 1 kg desde la variante', async () => {
  const result = await searchCatalogTool('seitán de un kilo', whatsappContext);
  assert.equal(result.products[0].variants.find((v) => v.name === '1 kg')?.price, 9900);
});

test('WhatsApp e Instagram comparten catálogo y read_only impide outbound', async () => {
  assert.deepEqual(await searchCatalogTool('Kostilles sin adobo', whatsappContext), await searchCatalogTool('Kostilles sin adobo', instagramContext));
  assert.equal(evaluateAutomaticWhatsAppReplyEntry({ channel: 'whatsapp', sendMode: 'read_only', afterGuard() {} }).allowed, false);
});
```

- [ ] **Step 2: Ejecutar RED, implementar tools compartidas y ejecutar GREEN**

Run: `node --test test/catalog-remy.test.ts test/messaging-capability-policy.test.ts test/messaging.test.ts`

- [ ] **Step 3: Commit aislado**

No modificar prompts con precios, sabores ni productos de campaña.

### Task 7: Administración y feed Meta

**Files:**
- Modify: `src/app/admin/productos/ProductoForm.tsx`
- Modify: `src/app/api/admin/products/route.ts`
- Modify: `src/app/api/admin/products/[id]/route.ts`
- Modify: `src/app/admin/temporadas/page.tsx`
- Modify: `src/app/api/admin/temporadas/route.ts`
- Modify: `src/app/api/admin/temporadas/[id]/route.ts`
- Create: `src/lib/meta/catalog-feed.ts`
- Create: `src/app/api/meta/catalog/feed/route.ts`
- Test: `test/catalog-admin.test.ts`
- Test: `test/meta-catalog-feed.test.ts`

**Interfaces:**
- Admin actualiza relaciones dentro de una transacción lógica server-side y valida tenant.
- Feed produce un item por variante vendible con `id`, `title`, `description`, `availability`, `condition`, `price`, `link`, `image_link` y `brand`.

- [ ] **Step 1: Escribir pruebas fallidas de flags administrativos y feed**

```ts
test('Dulces Típicos puede activarse en web sin cambiar código', async () => {
  const result = await updateCampaignProductVisibility(dulcesId, { visibleWeb: true });
  assert.equal(result.visibleWeb, true);
});

test('feed usa SKU, precio CLP y URL de la variante canónica', () => {
  const item = buildMetaFeedItem(seitan1kg);
  assert.equal(item.price, '9900 CLP');
  assert.equal(item.id, seitan1kg.sku);
});
```

- [ ] **Step 2: Ejecutar RED, implementar admin y feed, ejecutar GREEN**

Run: `node --test test/catalog-admin.test.ts test/meta-catalog-feed.test.ts`

- [ ] **Step 3: Auditar integración Meta real**

Si no hay `product_catalog`/`catalog_management`, no mutar activos sin autorización adicional; registrar bloqueo exacto. Si existe acceso legítimo, crear o reutilizar catálogo/feed y volver a consultar Meta para verificar IDs.

- [ ] **Step 4: Commit aislado**

```bash
git add src/app/admin/productos src/app/admin/temporadas src/app/api/admin/products src/app/api/admin/temporadas src/lib/meta/catalog-feed.ts src/app/api/meta/catalog/feed test/catalog-admin.test.ts test/meta-catalog-feed.test.ts
git commit -m "feat: administer and export catalog master"
```

### Task 8: Verificación integral y despliegue

**Files:**
- Create: `docs/operations/2026-09-01-fiestas-patrias-catalog-result.md`

- [ ] **Step 1: Ejecutar suite completa**

Run: `npm test`
Expected: cero fallos.

- [ ] **Step 2: Ejecutar lint y build**

Run: `npm run lint`
Run: `npm run build`
Expected: ambos exit 0.

- [ ] **Step 3: Verificar Supabase**

Consultar siete productos sin duplicados, variantes/SKUs/precios, selecciones, packs, campaña, RLS y advisors.

- [ ] **Step 4: Desplegar a Vercel Production**

Verificar deployment READY, dominio canónico y logs sin errores nuevos.

- [ ] **Step 5: E2E browser sin compra ni Purchase**

Recorrer catálogo → landing → producto → variante → opciones → carrito → checkout hasta antes del envío de pedido. Para persistencia de pedido usar una prueba controlada de integración que no marque pago ni dispare Purchase, y limpiar únicamente datos de prueba identificados cuando sea seguro.

- [ ] **Step 6: Verificar Remy por contextos web/WhatsApp/Instagram**

Ejecutar tools comerciales contra Supabase; confirmar respuestas correctas y cero outbound automático en canales `read_only`.

- [ ] **Step 7: Escribir reporte y commit final de documentación**

El reporte incluirá tabla `PRODUCTO | SUPABASE | WEB | REMY | WHATSAPP | INSTAGRAM | META CATALOG`, IDs, SKUs, URLs, assets, pruebas, deployment y bloqueos reales.
