import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveCatalogLine } from '../src/lib/catalog/selection.ts';
import type { CatalogProduct } from '../src/lib/catalog/types.ts';

const empanada: CatalogProduct = {
  id: 'product-empanada',
  businessUnitId: 'business-la-manito',
  slug: 'empanada-del-18',
  name: 'La Empanada del 18',
  description: null,
  imageUrl: null,
  active: true,
  variants: [
    {
      id: 'empanada-unit',
      productId: 'product-empanada',
      sku: 'FP26-EMP-UNIT',
      name: 'Unidad',
      price: 2900,
      weightGrams: 220,
      unitsIncluded: 1,
      selectionQuantity: 1,
      managesStock: false,
      stock: null,
      active: true,
      sortOrder: 10,
    },
    {
      id: 'empanada-pack-10',
      productId: 'product-empanada',
      sku: 'FP26-EMP-PACK10',
      name: 'Pack 10 unidades',
      price: 23900,
      weightGrams: 2200,
      unitsIncluded: 10,
      selectionQuantity: 10,
      managesStock: false,
      stock: null,
      active: true,
      sortOrder: 20,
    },
  ],
  optionGroups: [
    {
      id: 'empanada-flavor',
      productId: 'product-empanada',
      code: 'sabor',
      name: 'Sabores',
      selectionMode: 'quantity',
      required: true,
      active: true,
      sortOrder: 10,
      values: [
        { id: 'pino-soya', optionGroupId: 'empanada-flavor', code: 'pino-soya', label: 'Pino de soya', priceDelta: 0, active: true, sortOrder: 10 },
        { id: 'pino-seitan', optionGroupId: 'empanada-flavor', code: 'pino-seitan', label: 'Pino de seitán', priceDelta: 0, active: true, sortOrder: 20 },
        { id: 'napolitana', optionGroupId: 'empanada-flavor', code: 'napolitana', label: 'Napolitana', priceDelta: 0, active: true, sortOrder: 30 },
        { id: 'champinon', optionGroupId: 'empanada-flavor', code: 'champinon', label: 'Champiñón + queso vegano', priceDelta: 0, active: true, sortOrder: 40 },
      ],
    },
  ],
  packComponents: [],
};

const seitan: CatalogProduct = {
  ...empanada,
  id: 'product-seitan',
  slug: 'seitan-parrillero',
  name: 'Seitán Parrillero',
  variants: [
    {
      id: 'seitan-1kg',
      productId: 'product-seitan',
      sku: 'FP26-SEI-1KG',
      name: '1 kg',
      price: 9900,
      weightGrams: 1000,
      unitsIncluded: 1,
      selectionQuantity: 0,
      managesStock: false,
      stock: null,
      active: true,
      sortOrder: 20,
    },
  ],
  optionGroups: [],
};

test('acepta diez empanadas del mismo sabor y usa el precio canónico', () => {
  const result = resolveCatalogLine(empanada, {
    productId: empanada.id,
    variantId: 'empanada-pack-10',
    quantity: 1,
    clientPrice: 1,
    selections: [{ optionValueId: 'pino-seitan', quantity: 10 }],
  });

  assert.equal(result.ok, true);
  assert.equal(result.line?.unitPrice, 23900);
  assert.deepEqual(result.line?.selections.map((item) => [item.label, item.quantity]), [['Pino de seitán', 10]]);
});

test('acepta distribución cinco más cinco', () => {
  const result = resolveCatalogLine(empanada, {
    productId: empanada.id,
    variantId: 'empanada-pack-10',
    quantity: 1,
    selections: [
      { optionValueId: 'pino-soya', quantity: 5 },
      { optionValueId: 'napolitana', quantity: 5 },
    ],
  });

  assert.equal(result.ok, true);
  assert.equal(result.line?.selections.reduce((sum, item) => sum + item.quantity, 0), 10);
});

test('acepta una combinación múltiple que suma exactamente diez', () => {
  const result = resolveCatalogLine(empanada, {
    productId: empanada.id,
    variantId: 'empanada-pack-10',
    quantity: 2,
    selections: [
      { optionValueId: 'pino-seitan', quantity: 4 },
      { optionValueId: 'napolitana', quantity: 3 },
      { optionValueId: 'champinon', quantity: 3 },
    ],
  });

  assert.equal(result.ok, true);
  assert.equal(result.line?.lineTotal, 47800);
});

test('rechaza una selección cuya suma no coincide con la variante', () => {
  const result = resolveCatalogLine(empanada, {
    productId: empanada.id,
    variantId: 'empanada-pack-10',
    quantity: 1,
    selections: [
      { optionValueId: 'pino-seitan', quantity: 5 },
      { optionValueId: 'napolitana', quantity: 4 },
    ],
  });

  assert.deepEqual(result, { ok: false, error: 'selection_quantity_mismatch' });
});

test('rechaza valores de opción ajenos al producto', () => {
  const result = resolveCatalogLine(empanada, {
    productId: empanada.id,
    variantId: 'empanada-unit',
    quantity: 1,
    selections: [{ optionValueId: 'otro-tenant', quantity: 1 }],
  });

  assert.deepEqual(result, { ok: false, error: 'option_value_not_available' });
});

test('rechaza cantidad de línea fraccionaria o no positiva', () => {
  assert.deepEqual(resolveCatalogLine(seitan, {
    productId: seitan.id,
    variantId: 'seitan-1kg',
    quantity: 0,
    selections: [],
  }), { ok: false, error: 'invalid_quantity' });
});

test('usa la variante real y nunca el precio enviado por el cliente', () => {
  const result = resolveCatalogLine(seitan, {
    productId: seitan.id,
    variantId: 'seitan-1kg',
    quantity: 1,
    clientPrice: 1,
    selections: [],
  });

  assert.equal(result.ok, true);
  assert.equal(result.line?.unitPrice, 9900);
  assert.equal(result.line?.lineTotal, 9900);
});
