import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveCatalogCheckoutItem } from '../src/lib/catalog/catalog-checkout.ts';
import type { CatalogProduct } from '../src/lib/catalog/types.ts';

const product: CatalogProduct = {
  id: 'emp', businessUnitId: 'business', slug: 'empanada-del-18', name: 'La Empanada del 18',
  description: null, imageUrl: null, active: true, variants: [{
    id: 'pack10', productId: 'emp', sku: 'FP26-EMP-PACK10', name: 'Pack 10', price: 23900,
    weightGrams: 2200, unitsIncluded: 10, selectionQuantity: 10, managesStock: false,
    stock: null, active: true, sortOrder: 10,
  }],
  optionGroups: [{ id: 'flavors', productId: 'emp', code: 'sabor', name: 'Sabores', selectionMode: 'quantity', required: true, active: true, sortOrder: 10, values: [
    { id: 'pino', optionGroupId: 'flavors', code: 'pino', label: 'Pino', priceDelta: 0, active: true, sortOrder: 10 },
    { id: 'napo', optionGroupId: 'flavors', code: 'napo', label: 'Napolitana', priceDelta: 0, active: true, sortOrder: 20 },
  ] }], packComponents: [],
};

test('checkout ignora precio manipulado y conserva detalle 5+5', () => {
  const result = resolveCatalogCheckoutItem(product, {
    productoId: 'emp', variantId: 'pack10', qty: 1, clientPrice: 1,
    selections: [{ optionValueId: 'pino', quantity: 5 }, { optionValueId: 'napo', quantity: 5 }],
    campaignTag: 'fiestas-patrias-2026',
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.item.precio, 23900);
  assert.equal(result.item.variantSku, 'FP26-EMP-PACK10');
  assert.deepEqual(result.item.selections?.map((selection) => selection.quantity), [5, 5]);
});
test('checkout rechaza un pack cuya suma no sea diez', () => {
  const result = resolveCatalogCheckoutItem(product, {
    productoId: 'emp', variantId: 'pack10', qty: 1,
    selections: [{ optionValueId: 'pino', quantity: 9 }],
  });
  assert.deepEqual(result, { ok: false, error: 'selection_quantity_mismatch' });
});
