import assert from 'node:assert/strict';
import test from 'node:test';
import { collapseConversationBundleItems } from '../src/lib/orders/conversation-bundle-pricing.ts';
import { parseFormatos } from '../src/lib/pricing/formatos.ts';

const empanadaProduct = {
  id: 'empanada',
  name: 'La Empanada del 18',
  basePrice: 2900,
  formatLabels: ['220g', 'Pack 10'],
  variants: [
    { id: 'unit', name: 'Unidad', price: 2900, unitsIncluded: 1, active: true, sortOrder: 10 },
    { id: 'pack10', name: 'Pack 10', price: 23900, unitsIncluded: 10, active: true, sortOrder: 20 },
  ],
};

function item(quantity: number, variety: string) {
  return {
    productId: 'empanada',
    productName: 'La Empanada del 18',
    quantity,
    format: null,
    variety,
    customUnitPrice: null,
    isCustom: false,
  };
}

test('10 empanadas split by flavor collapse to the Pack 10 promotion at $23.900', () => {
  const result = collapseConversationBundleItems([
    item(2, 'Pino de soya'),
    item(2, 'Napolitana'),
    item(2, 'Champiñón + queso vegano'),
    item(2, 'Ratatouille'),
    item(2, 'Espinacas a la crema + queso vegano'),
  ], [empanadaProduct]);

  assert.equal(result.length, 1);
  assert.equal(result[0].quantity, 1);
  assert.equal(result[0].format, 'Pack 10');
  assert.equal(
    result[0].variety,
    '2 Pino de soya, 2 Napolitana, 2 Champiñón + queso vegano, 2 Ratatouille, 2 Espinacas a la crema + queso vegano',
  );

  const formats = parseFormatos('220g:2900,Pack 10:23900', 2900);
  const price = formats.find((format) => format.label === result[0].format)?.precio;
  assert.equal(price, 23900);
  assert.equal(Number(price) * result[0].quantity, 23900);
});

test('3 postres collapse to the active Pack 3 promotion at $10.000', () => {
  const postres = {
    id: 'postres',
    name: 'Postres en Frascos',
    basePrice: 4000,
    formatLabels: ['350g', 'Pack 3'],
    variants: [
      { id: 'unit', name: 'Unidad', price: 4000, unitsIncluded: 1, active: true, sortOrder: 10 },
      { id: 'pack3', name: 'Pack 3', price: 10000, unitsIncluded: 3, active: true, sortOrder: 20 },
    ],
  };
  const result = collapseConversationBundleItems([
    { ...item(1, 'Tiramisú'), productId: 'postres', productName: 'Postres en Frascos' },
    { ...item(1, 'Pie de Limón'), productId: 'postres', productName: 'Postres en Frascos' },
    { ...item(1, 'Manjar - Lúcuma'), productId: 'postres', productName: 'Postres en Frascos' },
  ], [postres]);

  assert.equal(result.length, 1);
  assert.equal(result[0].quantity, 1);
  assert.equal(result[0].format, 'Pack 3');
  assert.equal(result[0].bundleLineTotal, 10000);
});

test('inactive matching bundle is ignored', () => {
  const product = {
    ...empanadaProduct,
    variants: empanadaProduct.variants.map((variant) => variant.id === 'pack10' ? { ...variant, active: false } : variant),
  };
  const original = [item(10, 'Pino de soya')];
  const result = collapseConversationBundleItems(original, [product]);
  assert.equal(result.length, 1);
  assert.equal(result[0].quantity, 10);
  assert.equal(result[0].format, null);
});

test('unmatched quantity preserves current unit behavior', () => {
  const original = [item(4, 'Pino de soya')];
  const result = collapseConversationBundleItems(original, [empanadaProduct]);
  assert.equal(result.length, 1);
  assert.equal(result[0].quantity, 4);
  assert.equal(result[0].format, null);
});
