import assert from 'node:assert/strict';
import test from 'node:test';
import { toPublicCatalogProduct } from '../src/lib/catalog/public-dto.ts';
import type { CatalogProduct } from '../src/lib/catalog/types.ts';

const product: CatalogProduct = {
  id: 'empanada', businessUnitId: 'business', slug: 'empanada-del-18', name: 'La Empanada del 18',
  description: 'Solo por encargo.', imageUrl: '/empanada.webp', active: true,
  availabilityDates: ['2026-09-12'], emoji: '🥟', color: '#002f6c',
  variants: [{ id: 'pack10', productId: 'empanada', sku: 'FP26-EMP-PACK10', name: 'Pack 10', price: 23900, compareAtPrice: null, weightGrams: 2200, unitsIncluded: 10, selectionQuantity: 10, managesStock: false, stock: null, active: true, sortOrder: 20, imageUrl: null }],
  optionGroups: [], packComponents: [],
};

test('el DTO público conserva el catálogo vendible y excluye campos internos', () => {
  const dto = toPublicCatalogProduct(product);
  assert.equal(dto.variants[0].price, 23900);
  assert.deepEqual(dto.availabilityDates, ['2026-09-12']);
  assert.equal('businessUnitId' in dto, false);
  assert.equal('cost' in dto, false);
  assert.equal('metadata' in dto.variants[0], false);
});
