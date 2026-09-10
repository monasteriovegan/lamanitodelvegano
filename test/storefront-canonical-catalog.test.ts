import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { formatPriceSummary } from '../src/lib/catalog/price-summary.ts';

function read(path: string) { return fs.readFileSync(path, 'utf8'); }

test('storefront data loads normalized variants and option values for list and product detail', () => {
  const source = read('src/lib/data/catalogo.ts');
  assert.match(source, /product_variants/);
  assert.match(source, /product_option_groups/);
  assert.match(source, /product_option_values/);
  assert.match(source, /getProductoBySlug[\s\S]*product_option_groups/);
  assert.match(source, /getProductoById[\s\S]*product_option_groups/);
});

test('public purchase panel supports canonical variant selection and exact option quantities', () => {
  const source = read('src/components/tienda/ProductPurchasePanel.tsx');
  assert.match(source, /producto\.variants/);
  assert.match(source, /producto\.optionGroups/);
  assert.match(source, /selectionQuantity/);
  assert.match(source, /variantId/);
  assert.match(source, /toCatalogCartItem/);
  assert.match(source, /selectedVariant\.sku/);
  assert.match(source, /selections/);
});

test('product card opens detail when normalized variants or options require a choice', () => {
  const source = read('src/components/tienda/ProductCard.tsx');
  assert.match(source, /producto\.variants/);
  assert.match(source, /producto\.optionGroups/);
});

test('price summary labels weight variants by their names instead of treating grams as unit counts', () => {
  const summary = formatPriceSummary({
    precio: 10_900,
    variants: [
      { id: '120', name: '120 g', price: 10_900, selectionQuantity: 0, active: true },
      { id: '240', name: '240 g', price: 18_900, selectionQuantity: 0, active: true },
    ],
  });
  assert.equal(summary.packSummary, '120 g $10.900 · 240 g $18.900');
});

test('price summary preserves quantity-pack convention for box variants', () => {
  const summary = formatPriceSummary({
    precio: 10_900,
    variants: [
      { id: '9', name: '9 unidades', price: 10_900, selectionQuantity: 9, active: true },
      { id: '15', name: '15 unidades', price: 15_900, selectionQuantity: 15, active: true },
      { id: '24', name: '24 unidades', price: 19_900, selectionQuantity: 24, active: true },
    ],
  });
  assert.equal(summary.packSummary, '9 por $10.900 · 24 por $19.900');
});
