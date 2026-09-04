# Generic Seasonal Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the current Fiestas Patrias-specific channel/price editor into a generic seasonal catalog system with non-destructive price overrides and consistent promotion visibility across the storefront and commerce channels.

**Architecture:** `productos` + `product_variants` remain the permanent catalog source of truth. A new `season_variant_overrides` table stores optional season-scoped price/compare-at values without mutating master prices. `season_products` keeps channel visibility and product membership. Public loaders resolve an effective catalog from master + active season overrides, and admin routes become season-ID scoped instead of hardcoded to `fiestas-patrias-2026`.

**Tech Stack:** Next.js App Router, TypeScript, React, Supabase/Postgres, Vercel, GitHub Actions, Node test suite.

**Spec:** `docs/superpowers/specs/2026-09-03-generic-season-catalog-design.md`

## Global Constraints

- `Catálogo Master` remains the only permanent source of products, variants, master price and stock.
- Seasonal changes must never update `productos.precio` or `product_variants.price` implicitly.
- `season_products` remains responsible for membership, sort order, featured status and Web/WhatsApp/Instagram/Remy visibility.
- The seasonal module must be optional and generic; campaign-specific concepts are data, not code.
- All writes must be scoped to `business_unit_id` and admin authorization.
- No second seasonal stock ledger is introduced in this iteration.
- Existing Fiestas Patrias effective prices and variants must remain unchanged after migration.
- Web, WhatsApp, Instagram and Remy must consume the same effective catalog price logic.

---

### Task 1: Add season-scoped variant overrides

**Files:**
- Create: `supabase/migrations/20260904020000_season_variant_overrides.sql`
- Create: `test/season-variant-overrides-migration.test.ts`
- Modify: `src/lib/catalog/types.ts`

**Interfaces:**
- Produces DB table `public.season_variant_overrides` with `(season_id, variant_id)` uniqueness.
- Produces TypeScript type `CatalogVariantOverride` with `variantId`, `priceOverride`, `compareAtPriceOverride`, `isActive`.

- [ ] **Step 1: Write the failing migration contract test**

```ts
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

test('season variant overrides are isolated from master prices', () => {
  const sql = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/20260904020000_season_variant_overrides.sql'), 'utf8');
  assert.match(sql, /create table if not exists public\.season_variant_overrides/i);
  assert.match(sql, /season_id uuid not null/i);
  assert.match(sql, /variant_id uuid not null/i);
  assert.match(sql, /price_override integer/i);
  assert.match(sql, /compare_at_price_override integer/i);
  assert.match(sql, /unique\s*\(season_id,\s*variant_id\)/i);
  assert.doesNotMatch(sql, /update\s+public\.product_variants\s+set\s+price/i);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test test/season-variant-overrides-migration.test.ts`
Expected: FAIL because the migration file does not exist.

- [ ] **Step 3: Add the migration**

Create `public.season_variant_overrides` with:

```sql
create table if not exists public.season_variant_overrides (
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid not null references public.business_units(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  price_override integer check (price_override is null or price_override >= 0),
  compare_at_price_override integer check (compare_at_price_override is null or compare_at_price_override >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, variant_id)
);
```

Add an integrity trigger/function that rejects a row unless the season and variant belong to the same `business_unit_id`, and rejects `compare_at_price_override < coalesce(price_override, master_variant.price)`.

Enable RLS; allow public SELECT only through active, public season/product context; allow admin authenticated writes; grant service role full access.

- [ ] **Step 4: Extend catalog types**

Add:

```ts
export interface CatalogVariantOverride {
  variantId: string;
  priceOverride: number | null;
  compareAtPriceOverride: number | null;
  isActive: boolean;
}
```

- [ ] **Step 5: Run migration contract test**

Run: `node --test test/season-variant-overrides-migration.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260904020000_season_variant_overrides.sql test/season-variant-overrides-migration.test.ts src/lib/catalog/types.ts
git commit -m "feat(catalog): add seasonal variant overrides"
```

---

### Task 2: Resolve effective seasonal prices in one catalog loader

**Files:**
- Create: `src/lib/catalog/seasonal-catalog.ts`
- Create: `test/seasonal-catalog.test.ts`
- Modify: `src/lib/catalog/catalog-data.ts`
- Modify: `src/lib/catalog/public-dto.ts`
- Modify: `src/lib/catalog/remy-catalog.ts`

**Interfaces:**
- Produces `applySeasonVariantOverrides(product, overrides): CatalogProduct`.
- Produces `loadSeasonCatalog(db, businessUnitId, seasonIdOrTag, channel)` returning the effective catalog.
- Existing `loadCatalogCampaign()` delegates to the new resolver.

- [ ] **Step 1: Write failing unit tests for override behavior**

Cover:

```ts
assert.equal(effective.variants[0].price, 23900);
assert.equal(master.variants[0].price, 2900);
```

and no override fallback:

```ts
assert.equal(effective.variants[0].price, master.variants[0].price);
```

Also test inactive/expired season returns no campaign.

- [ ] **Step 2: Run focused test and verify RED**

Run: `node --test test/seasonal-catalog.test.ts`
Expected: FAIL because resolver does not exist.

- [ ] **Step 3: Implement pure override application**

`applySeasonVariantOverrides()` must clone variants and return:

```ts
{
  ...variant,
  price: override?.priceOverride ?? variant.price,
  compareAtPrice: override?.compareAtPriceOverride ?? variant.compareAtPrice,
}
```

Never mutate the original product object.

- [ ] **Step 4: Implement DB loader**

`loadSeasonCatalog()` must:
- fetch one active season scoped by business unit using ID or campaign tag;
- reject expired `ends_at` and future `starts_at` for public channel loads;
- fetch `season_products` for the requested channel;
- load master products with `CatalogRepository`;
- fetch overrides for the selected season;
- apply overrides only to variants belonging to linked products;
- preserve Web/WhatsApp/Instagram/Remy visibility behavior.

- [ ] **Step 5: Delegate existing campaign loader**

Replace duplicated catalog assembly in `catalog-data.ts` with the new resolver while preserving `loadDefaultCatalogCampaign(campaignTag, channel)` public signature.

- [ ] **Step 6: Route Remy through the same effective price helper**

Where Remy loads active seasonal catalog, use the same resolver rather than reconstructing prices independently.

- [ ] **Step 7: Run focused tests**

Run: `node --test test/seasonal-catalog.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/catalog/seasonal-catalog.ts src/lib/catalog/catalog-data.ts src/lib/catalog/public-dto.ts src/lib/catalog/remy-catalog.ts test/seasonal-catalog.test.ts
git commit -m "feat(catalog): resolve seasonal effective prices"
```

---

### Task 3: Replace hardcoded Fiestas Patrias admin editor with a generic season editor

**Files:**
- Create: `src/app/admin/temporadas/[id]/catalogo/page.tsx`
- Create: `src/app/admin/temporadas/[id]/catalogo/SeasonCatalogEditor.tsx`
- Create: `src/app/api/admin/temporadas/[id]/catalogo/route.ts`
- Modify: `src/app/admin/temporadas/page.tsx`
- Modify: `src/app/admin/catalogo-master/page.tsx`
- Modify: admin sidebar/navigation file discovered by code search
- Create: `test/admin-season-catalog.test.ts`

**Interfaces:**
- GET `/api/admin/temporadas/:id/catalogo` returns season metadata + linked products + master variants + season overrides.
- PATCH accepts `{ productId, visibleWeb?, visibleWhatsapp?, visibleInstagram?, availableToRemy?, variantId?, priceOverride?, compareAtPriceOverride?, clearOverride? }`.

- [ ] **Step 1: Write failing contract tests**

Assert:
- no `CAMPAIGN_TAG = 'fiestas-patrias-2026'` in the new API/editor;
- PATCH writes `season_variant_overrides` for seasonal prices;
- PATCH does not update `product_variants.price` for seasonal price changes;
- `/admin/catalogo-master` redirects to `/admin/temporadas`;
- sidebar no longer exposes `Canales & Precios` as a top-level item.

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test test/admin-season-catalog.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement season-scoped GET**

Validate admin role, load season by `id` + current business unit, then return linked products, master variants, option groups/values and override rows.

- [ ] **Step 4: Implement season-scoped PATCH**

For visibility fields, update only `season_products` for the current season/product.

For seasonal price fields, upsert:

```ts
{
  business_unit_id: business.id,
  season_id: season.id,
  variant_id: update.variantId,
  price_override: update.priceOverride ?? null,
  compare_at_price_override: update.compareAtPriceOverride ?? null,
  is_active: true,
}
```

For `clearOverride`, delete that `(season_id, variant_id)` row.

Do not modify master variant price from this endpoint.

- [ ] **Step 5: Build generic editor UI**

Display season name in header and, per variant:
- `Precio maestro` read-only;
- `Precio de esta temporada` editable optional field;
- `Precio anterior / referencia` editable optional field;
- clear override action;
- Web, WhatsApp, Instagram, Remy checkboxes at product level.

- [ ] **Step 6: Link from season list**

Add `Gestionar productos y canales` to each season card/row, linking to `/admin/temporadas/${id}/catalogo`.

- [ ] **Step 7: Simplify old route and navigation**

`/admin/catalogo-master` becomes a server redirect to `/admin/temporadas`.
Remove the top-level `Canales & Precios` sidebar item and keep `Catálogo Master`, `Temporadas & Colecciones`, `Categorías` under the catalog grouping.

- [ ] **Step 8: Run contract tests**

Run: `node --test test/admin-season-catalog.test.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/app/admin/temporadas src/app/api/admin/temporadas src/app/admin/catalogo-master test/admin-season-catalog.test.ts <sidebar-file>
git commit -m "feat(admin): make seasonal catalog editor generic"
```

---

### Task 4: Make storefront cards always receive normalized variants and promotions

**Files:**
- Modify: `src/lib/data/catalogo.ts`
- Modify: `src/components/tienda/ProductCard.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/types/domain.ts` if needed to expose normalized variants on `Producto`
- Create: `test/storefront-price-summary.test.ts`

**Interfaces:**
- `getProductosActivos()` returns each active product with active normalized variants attached.
- `ProductCard` and `Destacados & Ofertas` both render `formatPriceSummary(product)`.

- [ ] **Step 1: Write failing tests for card input and featured rendering**

Assert `catalogo.ts` queries `product_variants` and attaches variants to products.
Assert `src/app/page.tsx` imports/uses `formatPriceSummary` instead of directly printing only `p.precio` in featured cards.

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test test/storefront-price-summary.test.ts`
Expected: FAIL.

- [ ] **Step 3: Enrich product loader**

After loading active products, load active variants for their IDs and attach:

```ts
variants: rows.map(v => ({
  id: v.id,
  name: v.name,
  price: Number(v.price),
  selectionQuantity: Number(v.selection_quantity || 0),
  isDefault: v.sort_order === 0,
  active: Boolean(v.is_active),
}))
```

Keep legacy fallback behavior for products with no normalized variants.

- [ ] **Step 4: Avoid repeated summary calculation in ProductCard**

Compute once:

```ts
const priceSummary = formatPriceSummary(producto);
```

Use it for display/original/pack summary.

- [ ] **Step 5: Use the same price summary in featured cards**

Render effective display price, optional crossed-out original price and optional pack summary such as `1 por $2.900 · 10 por $23.900`.

- [ ] **Step 6: Run focused tests**

Run: `node --test test/storefront-price-summary.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/data/catalogo.ts src/components/tienda/ProductCard.tsx src/app/page.tsx src/types/domain.ts test/storefront-price-summary.test.ts
git commit -m "feat(storefront): surface promotional pack pricing"
```

---

### Task 5: Migrate Fiestas Patrias safely and verify cross-channel behavior

**Files:**
- Create: `supabase/migrations/20260904023000_migrate_fiestas_patrias_overrides.sql`
- Create: `test/fiestas-patrias-season-migration.test.ts`
- Modify only if verification requires: `src/components/tienda/CampaignCatalog.tsx`

**Interfaces:**
- Existing `fiestas-patrias-2026` season remains available with unchanged effective storefront prices.

- [ ] **Step 1: Write migration safety test**

Assert the migration:
- finds season by business + `campaign_tag`;
- inserts/upserts only `season_variant_overrides` when a season-specific value is known;
- does not delete products/seasons;
- does not overwrite master prices broadly.

- [ ] **Step 2: Run test and verify RED**

Run: `node --test test/fiestas-patrias-season-migration.test.ts`
Expected: FAIL because migration is absent.

- [ ] **Step 3: Add data migration**

Seed override rows only for the known Fiestas Patrias variant pricing that is explicitly represented by the current approved campaign variants. If master and campaign value are the same, no override row is needed.

Never synthesize a historical master price that cannot be proven from current data.

- [ ] **Step 4: Run migration test**

Run: `node --test test/fiestas-patrias-season-migration.test.ts`
Expected: PASS.

- [ ] **Step 5: Run cross-channel tests**

Run:
```bash
node --test test/seasonal-catalog.test.ts test/admin-season-catalog.test.ts test/storefront-price-summary.test.ts test/fiestas-patrias-season-migration.test.ts
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260904023000_migrate_fiestas_patrias_overrides.sql test/fiestas-patrias-season-migration.test.ts src/components/tienda/CampaignCatalog.tsx
git commit -m "migrate(catalog): preserve Fiestas Patrias seasonal pricing"
```

---

### Task 6: Full verification, migration, merge and production smoke test

**Files:**
- No new product files unless verification exposes a defect.

**Interfaces:**
- Production must satisfy all spec closure criteria.

- [ ] **Step 1: Run complete local/CI-equivalent verification**

Run the repository's full test, TypeScript, worker syntax, lint and build commands used by CI.
Expected: all green.

- [ ] **Step 2: Open PR and inspect diff**

Confirm no seasonal admin code writes `product_variants.price` and no top-level `Canales & Precios` remains.

- [ ] **Step 3: Apply Supabase migrations in order**

Apply:
1. `20260904020000_season_variant_overrides.sql`
2. `20260904023000_migrate_fiestas_patrias_overrides.sql`

Verify table/indexes and Fiestas Patrias effective data after each migration.

- [ ] **Step 4: Merge only after CI green**

Merge branch into `main` after full CI passes.

- [ ] **Step 5: Verify Vercel production**

Wait for `target=production`, `state=READY` on the merged SHA.

- [ ] **Step 6: Smoke-test admin navigation**

Verify:
- Catálogo Master remains available;
- Temporadas & Colecciones is visible;
- no top-level Canales & Precios;
- Fiestas Patrias opens its generic catalog editor;
- a temporary second season can be created/edited without code changes, then deactivated/deleted.

- [ ] **Step 7: Smoke-test storefront**

Verify:
- normal product cards show unit + pack/promo when applicable;
- featured cards show the same price summary;
- Fiestas Patrias page preserves approved effective pricing;
- no expired/deactivated season override leaks into normal catalog.

- [ ] **Step 8: Verify channel consistency**

For one Fiestas Patrias product, compare effective variant price returned for Web, WhatsApp, Instagram and Remy. All must match the same seasonal resolver unless channel visibility intentionally hides the product.

- [ ] **Step 9: Final production evidence**

Record merged SHA, CI run status, production deployment ID/state, migration verification results and smoke-test results before declaring completion.
