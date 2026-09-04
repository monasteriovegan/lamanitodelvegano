import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { buildMetaFeedItem, serializeMetaCatalogCsv } from '../src/lib/meta/catalog-feed.ts';
import { toRemyCatalogProduct } from '../src/lib/catalog/remy-catalog.ts';
import { toPublicCatalogProduct } from '../src/lib/catalog/public-dto.ts';
import type { CatalogProduct } from '../src/lib/catalog/types.ts';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

const sampleEmpanada: CatalogProduct = {
  id: 'prod-emp-18',
  businessUnitId: 'bu-1',
  slug: 'empanada-del-18',
  name: 'La Empanada del 18',
  description: 'Empanadas veganas artesanales de aproximadamente 220 g cada una.',
  imageUrl: 'https://lamanitodelvegano.cl/campaigns/fiestas-patrias-2026/empanada-del-18.webp',
  active: true,
  sku: 'FP26-EMP',
  glutenFree: false,
  nutFree: false,
  availabilityDates: ['2026-09-12', '2026-09-15', '2026-09-16'],
  variants: [
    {
      id: 'var-1', productId: 'prod-emp-18', sku: 'FP26-EMP-UNIT', name: 'Unidad', price: 2900,
      weightGrams: 220, unitsIncluded: 1, selectionQuantity: 1, managesStock: false, stock: null, active: true, sortOrder: 10,
    },
    {
      id: 'var-2', productId: 'prod-emp-18', sku: 'FP26-EMP-PACK10', name: 'Pack 10', price: 23900,
      weightGrams: 2200, unitsIncluded: 10, selectionQuantity: 10, managesStock: false, stock: null, active: true, sortOrder: 20,
    },
  ],
  optionGroups: [
    {
      id: 'grp-sabor', productId: 'prod-emp-18', code: 'sabor', name: 'Sabores', selectionMode: 'quantity',
      required: true, active: true, sortOrder: 10,
      values: [
        { id: 'val-1', optionGroupId: 'grp-sabor', code: 'pino-soya', label: 'Pino de soya', priceDelta: 0, active: true, sortOrder: 10 },
        { id: 'val-2', optionGroupId: 'grp-sabor', code: 'pino-seitan', label: 'Pino de seitán', priceDelta: 0, active: true, sortOrder: 20 },
      ],
    },
  ],
  packComponents: [],
};

test('Canonical Catalog: Remy, Web DTO and Meta Feed consume the same product source without divergence', () => {
  const remy = toRemyCatalogProduct(sampleEmpanada);
  const web = toPublicCatalogProduct(sampleEmpanada);
  const metaFeedItem = buildMetaFeedItem({
    product: { slug: sampleEmpanada.slug, name: sampleEmpanada.name, description: sampleEmpanada.description, imageUrl: sampleEmpanada.imageUrl },
    variant: sampleEmpanada.variants[0],
  });

  // Equality in canonical fields
  assert.equal(remy.name, sampleEmpanada.name);
  assert.equal(web.name, sampleEmpanada.name);
  assert.equal(remy.slug, sampleEmpanada.slug);
  assert.equal(web.slug, sampleEmpanada.slug);
  assert.equal(remy.variants[0].price, 2900);
  assert.equal(web.variants[0].price, 2900);
  assert.equal(remy.variants[0].sku, 'FP26-EMP-UNIT');
  assert.equal(web.variants[0].sku, 'FP26-EMP-UNIT');

  // Meta feed ID matches variant SKU exactly
  assert.equal(metaFeedItem.id, 'FP26-EMP-UNIT');
  assert.equal(metaFeedItem.price, '2900 CLP');
});

test('Gluten / Nut Claims: base products containing gluten are marked false and no default badge is emitted', () => {
  assert.equal(sampleEmpanada.glutenFree, false);
  assert.equal(sampleEmpanada.nutFree, false);

  const purchasePanelCode = read('src/components/tienda/ProductPurchasePanel.tsx');
  // Must not have unverified claims
  assert.ok(!purchasePanelCode.includes('🌾 Sin Gluten'));
  assert.ok(!purchasePanelCode.includes('🥜 Sin Nueces'));
});

test('Meta Pixel and CAPI Matching: content_ids prioritizes variant SKU', () => {
  const capiCode = read('src/lib/meta/conversions-api.ts');
  assert.match(capiCode, /item\.sku\s*\|\|\s*item\.variantSku/);

  const clientTrackingCode = read('src/lib/analytics/client.ts');
  assert.match(clientTrackingCode, /content_ids:\s*items\.map/);
});

test('Exclusion of Test Products: repository filters out test products from active public queries', () => {
  const repoCode = read('src/lib/catalog/catalog-repository.ts');
  assert.match(repoCode, /isTest\s*=\s*\/prueba\/i/);
});
