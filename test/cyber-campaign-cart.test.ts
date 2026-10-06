import assert from 'node:assert/strict';
import test from 'node:test';
import { toCampaignTargetCartItem } from '../src/lib/catalog/catalog-cart.ts';
import { evaluateOptionSelection } from '../src/lib/catalog/purchase-option-state.ts';
import type { CatalogCampaignPurchaseTarget } from '../src/lib/catalog/types.ts';

const tag = 'cyber-day-chocolatoso-2026';
const activeTarget: CatalogCampaignPurchaseTarget = {
  id: 'link-dubai-240',
  productId: 'product-dubai',
  productName: 'Barra Dubái',
  variantId: 'variant-dubai-240',
  variantSku: 'LMV-DUBAI-240G',
  groupLabel: 'Dubái',
  optionLabel: '240 g',
  sortOrder: 20,
  price: 17900,
  compareAtPrice: 22900,
  managesStock: false,
  stock: null,
};

test('campaign target cart item keeps the canonical target product and variant', () => {
  const item = toCampaignTargetCartItem('Elige tu universo Cyber', activeTarget, 1, tag);
  assert.equal(item?.productoId, 'product-dubai');
  assert.equal(item?.nombre, 'Barra Dubái');
  assert.equal(item?.variantId, 'variant-dubai-240');
  assert.equal(item?.variantSku, 'LMV-DUBAI-240G');
  assert.equal(item?.precio, 17900);
  assert.equal(item?.formato, 'Dubái · 240 g');
  assert.equal(item?.campaignTag, tag);
});

test('campaign target rejects non-positive quantity and insufficient stock', () => {
  const outOfStockTarget = { ...activeTarget, managesStock: true, stock: 0 };
  assert.equal(toCampaignTargetCartItem('Barra Cyber', outOfStockTarget, 1, tag), null);
  assert.equal(toCampaignTargetCartItem('Barra Cyber', activeTarget, 0, tag), null);
});

test('Cyber flavor boxes require the exact selected size: 9, 15 or 24', () => {
  const groups = [{
    id: 'sabores', name: 'Combina tus sabores', selectionMode: 'quantity' as const, required: true,
    values: [
      { id: 'chai', code: 'chai', label: 'Té chai', priceDelta: 0 },
      { id: 'snickers', code: 'snickers', label: 'Caramelo salado', priceDelta: 0 },
    ],
  }];
  for (const size of [9, 15, 24]) {
    assert.equal(evaluateOptionSelection(groups, { sabores: { chai: size } }, size, 1).valid, true);
    assert.equal(evaluateOptionSelection(groups, { sabores: { chai: size - 1 } }, size, 1).valid, false);
    assert.equal(evaluateOptionSelection(groups, { sabores: { chai: size + 1 } }, size, 1).valid, false);
  }
});
