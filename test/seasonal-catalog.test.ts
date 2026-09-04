import assert from 'node:assert/strict';
import test from 'node:test';
import { applySeasonVariantOverrides, seasonIsInWindow } from '../src/lib/catalog/seasonal-catalog.ts';
import type { CatalogProduct } from '../src/lib/catalog/types.ts';

const master: CatalogProduct = {
  id: 'p1', businessUnitId: 'b1', slug: 'empanada', name: 'Empanada', description: null, imageUrl: null, active: true,
  variants: [
    { id: 'v1', productId: 'p1', sku: 'UNIT', name: 'Unidad', price: 3000, compareAtPrice: null, weightGrams: null, unitsIncluded: 1, selectionQuantity: 1, managesStock: false, stock: null, active: true, sortOrder: 10 },
    { id: 'v10', productId: 'p1', sku: 'PACK10', name: 'Pack 10', price: 26000, compareAtPrice: null, weightGrams: null, unitsIncluded: 10, selectionQuantity: 10, managesStock: false, stock: null, active: true, sortOrder: 20 },
  ],
  optionGroups: [], packComponents: [],
};

test('season override changes effective price without mutating master', () => {
  const effective = applySeasonVariantOverrides(master, [
    { variantId: 'v10', priceOverride: 23900, compareAtPriceOverride: 26000, isActive: true },
  ]);
  assert.equal(effective.variants[1].price, 23900);
  assert.equal(effective.variants[1].compareAtPrice, 26000);
  assert.equal(master.variants[1].price, 26000);
  assert.equal(master.variants[1].compareAtPrice, null);
});

test('missing or inactive override falls back to master price', () => {
  const effective = applySeasonVariantOverrides(master, [
    { variantId: 'v10', priceOverride: 23900, compareAtPriceOverride: 26000, isActive: false },
  ]);
  assert.equal(effective.variants[1].price, 26000);
});

test('season date window accepts active dates and rejects future/expired dates', () => {
  const now = new Date('2026-09-15T12:00:00Z');
  assert.equal(seasonIsInWindow('2026-09-01', '2026-09-18', now), true);
  assert.equal(seasonIsInWindow('2026-09-20', '2026-09-30', now), false);
  assert.equal(seasonIsInWindow('2026-08-01', '2026-08-31', now), false);
});
