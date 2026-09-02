import assert from 'node:assert/strict';
import test from 'node:test';
import { catalogCartItemKey, toCatalogCartItem } from '../src/lib/catalog/catalog-cart.ts';

const resolved = {
  productId: 'empanada', productName: 'La Empanada del 18', variantId: 'pack10',
  variantSku: 'FP26-EMP-PACK10', variantName: 'Pack 10', unitPrice: 23900,
  quantity: 1, lineTotal: 23900,
  selections: [
    { optionGroupId: 'flavors', optionGroupName: 'Sabores', optionValueId: 'pino', code: 'pino', label: 'Pino de seitán', quantity: 5 },
    { optionGroupId: 'flavors', optionGroupName: 'Sabores', optionValueId: 'napo', code: 'napo', label: 'Napolitana', quantity: 3 },
    { optionGroupId: 'flavors', optionGroupName: 'Sabores', optionValueId: 'champ', code: 'champ', label: 'Champiñón', quantity: 2 },
  ],
};

test('el carrito conserva 5+3+2 con variante estable y precio canónico', () => {
  const item = toCatalogCartItem(resolved, { campaignTag: 'fiestas-patrias-2026' });
  assert.equal(item.variantId, 'pack10');
  assert.equal(item.variantSku, 'FP26-EMP-PACK10');
  assert.equal(item.precio, 23900);
  assert.deepEqual(item.selections?.map((selection) => selection.quantity), [5, 3, 2]);
});
test('la clave distingue combinaciones y es estable aunque cambie el orden', () => {
  const first = toCatalogCartItem(resolved);
  const reordered = { ...first, selections: [...(first.selections || [])].reverse() };
  assert.equal(catalogCartItemKey(first), catalogCartItemKey(reordered));
  assert.notEqual(catalogCartItemKey(first), catalogCartItemKey({ ...first, variantId: 'unit' }));
});
