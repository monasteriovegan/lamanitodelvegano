import assert from 'node:assert/strict';
import test from 'node:test';
import { collapseImplicitBundleIntents, findActiveVariantForFormat } from '../src/lib/pricing/bundle-intents.ts';
import { parseFormatos } from '../src/lib/pricing/formatos.ts';

const empanadaProduct = {
  id: 'empanada',
  name: 'La Empanada del 18',
  basePrice: 2900,
  managesStock: false,
  formatLabels: ['220g', 'Pack 10'],
  variants: [
    { id: 'unit', name: 'Unidad', price: 2900, unitsIncluded: 1, active: true, sortOrder: 10, sku: 'FP26-EMP-UNIT' },
    { id: 'pack10', name: 'Pack 10', price: 23900, unitsIncluded: 10, active: true, sortOrder: 20, sku: 'FP26-EMP-PACK10' },
  ],
};

function item(qty: number, variedad: string) {
  return {
    productoId: 'empanada',
    qty,
    formato: null,
    variedad,
  };
}

test('10 empanadas split by flavor collapse to the Pack 10 promotion at $23.900', () => {
  const result = collapseImplicitBundleIntents([
    item(2, 'Pino de soya'),
    item(2, 'Napolitana'),
    item(2, 'Champiñón + queso vegano'),
    item(2, 'Ratatouille'),
    item(2, 'Espinacas a la crema + queso vegano'),
  ], [empanadaProduct]);

  assert.equal(result.length, 1);
  assert.equal(result[0].qty, 1);
  assert.equal(result[0].formato, 'Pack 10');
  assert.equal(
    result[0].variedad,
    '2 Pino de soya, 2 Napolitana, 2 Champiñón + queso vegano, 2 Ratatouille, 2 Espinacas a la crema + queso vegano',
  );

  const formats = parseFormatos('220g:2900,Pack 10:23900', 2900);
  const price = formats.find((format) => format.label === result[0].formato)?.precio;
  assert.equal(price, 23900);
  assert.equal(Number(price) * result[0].qty, 23900);
});

test('Pack 10 format resolves to its canonical active variant and SKU', () => {
  const variant = findActiveVariantForFormat('Pack 10', empanadaProduct.variants);
  assert.equal(variant?.id, 'pack10');
  assert.equal(variant?.price, 23900);
  assert.equal(variant?.sku, 'FP26-EMP-PACK10');
});

test('3 postres collapse to the active Pack 3 promotion at $10.000', () => {
  const postres = {
    id: 'postres',
    name: 'Postres en Frascos',
    basePrice: 4000,
    managesStock: false,
    formatLabels: ['350g', 'Pack 3'],
    variants: [
      { id: 'unit', name: 'Unidad', price: 4000, unitsIncluded: 1, active: true, sortOrder: 10 },
      { id: 'pack3', name: 'Pack 3', price: 10000, unitsIncluded: 3, active: true, sortOrder: 20 },
    ],
  };
  const result = collapseImplicitBundleIntents([
    { ...item(1, 'Tiramisú'), productoId: 'postres' },
    { ...item(1, 'Pie de Limón'), productoId: 'postres' },
    { ...item(1, 'Manjar - Lúcuma'), productoId: 'postres' },
  ], [postres]);

  assert.equal(result.length, 1);
  assert.equal(result[0].qty, 1);
  assert.equal(result[0].formato, 'Pack 3');
  const formats = parseFormatos('350g:4000,Pack 3:10000', 4000);
  const price = formats.find((format) => format.label === result[0].formato)?.precio;
  assert.equal(Number(price) * result[0].qty, 10000);
});

test('inactive matching bundle is ignored', () => {
  const product = {
    ...empanadaProduct,
    variants: empanadaProduct.variants.map((variant) => variant.id === 'pack10' ? { ...variant, active: false } : variant),
  };
  const original = [item(10, 'Pino de soya')];
  const result = collapseImplicitBundleIntents(original, [product]);
  assert.equal(result.length, 1);
  assert.equal(result[0].qty, 10);
  assert.equal(result[0].formato, null);
});

test('unmatched quantity preserves current unit behavior', () => {
  const original = [item(4, 'Pino de soya')];
  const result = collapseImplicitBundleIntents(original, [empanadaProduct]);
  assert.equal(result.length, 1);
  assert.equal(result[0].qty, 4);
  assert.equal(result[0].formato, null);
});

test('stock-managed legacy products are not collapsed implicitly', () => {
  const product = { ...empanadaProduct, managesStock: true };
  const result = collapseImplicitBundleIntents([item(10, 'Pino de soya')], [product]);
  assert.equal(result[0].qty, 10);
  assert.equal(result[0].formato, null);
});
