import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveCatalogLine } from '../src/lib/catalog/selection.ts';
import { toPublicCatalogProduct } from '../src/lib/catalog/public-dto.ts';
import type { CatalogOptionGroup, CatalogProduct } from '../src/lib/catalog/types.ts';

const BUSINESS_ID = 'f3b57ce7-0796-40e5-94f1-07cb2b48ba85';

function quantityGroup(productId: string): CatalogOptionGroup {
  return {
    id: `group-${productId}`,
    productId,
    code: 'sabor',
    name: 'Sabores',
    selectionMode: 'quantity',
    required: true,
    active: true,
    sortOrder: 10,
    values: [
      { id: `soya-${productId}`, optionGroupId: `group-${productId}`, code: 'soya', label: 'Pino de soya', priceDelta: 0, active: true, sortOrder: 10 },
      { id: `seitan-${productId}`, optionGroupId: `group-${productId}`, code: 'seitan', label: 'Pino de seitán', priceDelta: 0, active: true, sortOrder: 20 },
    ],
  };
}

function empanadaProduct(selectionQuantity = 1): CatalogProduct {
  const productId = 'empanada-product';
  return {
    id: productId,
    businessUnitId: BUSINESS_ID,
    slug: 'empanada-del-18',
    name: 'La Empanada del 18',
    description: null,
    imageUrl: null,
    active: true,
    variants: [{
      id: 'empanada-unit',
      productId,
      sku: 'FP26-EMP-UNIT',
      name: selectionQuantity === 1 ? 'Unidad' : 'Pack 10',
      price: selectionQuantity === 1 ? 2900 : 23900,
      weightGrams: null,
      unitsIncluded: selectionQuantity,
      selectionQuantity,
      managesStock: false,
      stock: null,
      active: true,
      sortOrder: 10,
    }],
    optionGroups: [quantityGroup(productId)],
    packComponents: [],
  };
}

test('two unit empanadas may allocate two different flavors', () => {
  const product = empanadaProduct(1);
  const result = resolveCatalogLine(product, {
    productId: product.id,
    variantId: product.variants[0].id,
    quantity: 2,
    selections: [
      { optionValueId: `soya-${product.id}`, quantity: 1 },
      { optionValueId: `seitan-${product.id}`, quantity: 1 },
    ],
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.line.quantity, 2);
    assert.equal(result.line.lineTotal, 5800);
  }
});

test('two unit empanadas reject an incomplete one-flavor allocation', () => {
  const product = empanadaProduct(1);
  const result = resolveCatalogLine(product, {
    productId: product.id,
    variantId: product.variants[0].id,
    quantity: 2,
    selections: [{ optionValueId: `soya-${product.id}`, quantity: 1 }],
  });
  assert.deepEqual(result, { ok: false, error: 'selection_quantity_mismatch' });
});

test('two Pack 10 empanadas require 20 flavor allocations', () => {
  const product = empanadaProduct(10);
  const result = resolveCatalogLine(product, {
    productId: product.id,
    variantId: product.variants[0].id,
    quantity: 2,
    selections: [
      { optionValueId: `soya-${product.id}`, quantity: 12 },
      { optionValueId: `seitan-${product.id}`, quantity: 8 },
    ],
  });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.line.lineTotal, 47800);
});

test('pack inherits required option groups from linked canonical child product', () => {
  const childProductId = 'kostilles-product';
  const childGroup: CatalogOptionGroup = {
    id: 'kostilles-adobo',
    productId: childProductId,
    code: 'adobo',
    name: 'Adobo',
    selectionMode: 'single',
    required: true,
    active: true,
    sortOrder: 10,
    values: [
      { id: 'adobo-barbecue', optionGroupId: 'kostilles-adobo', code: 'barbecue', label: 'Barbecue', priceDelta: 0, active: true, sortOrder: 10 },
      { id: 'adobo-mostaza', optionGroupId: 'kostilles-adobo', code: 'mostaza', label: 'Mostaza', priceDelta: 0, active: true, sortOrder: 20 },
    ],
  };
  const pack: CatalogProduct = {
    id: 'pack-parrillero-2',
    businessUnitId: BUSINESS_ID,
    slug: 'pack-parrillero-vegano-2',
    name: 'Pack Parrillero Vegano 2',
    description: null,
    imageUrl: null,
    active: true,
    variants: [{
      id: 'pack-variant', productId: 'pack-parrillero-2', sku: 'FP26-PARR-02', name: 'Pack', price: 15000,
      weightGrams: null, unitsIncluded: 1, selectionQuantity: 0, managesStock: false, stock: null, active: true, sortOrder: 10,
    }],
    optionGroups: [],
    packComponents: [{
      id: 'component-kostilles',
      componentProductId: childProductId,
      componentName: 'Le Kostilles al vacío',
      quantity: 1,
      unit: 'pack',
      weightGrams: null,
      sortOrder: 40,
      optionGroups: [childGroup],
    }],
  };

  const publicProduct = toPublicCatalogProduct(pack);
  assert.equal(publicProduct.optionGroups.length, 1);
  assert.equal(publicProduct.optionGroups[0].name, 'Le Kostilles al vacío — Adobo');

  const result = resolveCatalogLine(pack, {
    productId: pack.id,
    variantId: pack.variants[0].id,
    quantity: 1,
    selections: [{ optionValueId: 'adobo-barbecue', quantity: 1 }],
  });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.line.selections[0].label, 'Barbecue');
});

test('storefront does not offer Flow while it is disabled', () => {
  const checkout = readFileSync(new URL('../src/app/checkout/page.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(checkout, /value:\s*['"]flow['"]/);
  assert.match(checkout, /Mercado Pago/);
  assert.match(checkout, /Coordinar por WhatsApp/);
});

test('disabled Flow is rejected before customer or order writes', () => {
  const checkoutRoute = readFileSync(new URL('../src/app/api/checkout/route.ts', import.meta.url), 'utf8');
  const flowGuard = checkoutRoute.indexOf("paymentMethod === 'flow'");
  const customerWrite = checkoutRoute.indexOf('upsertCheckoutContact');
  assert.ok(flowGuard > -1);
  assert.ok(customerWrite > flowGuard);
  assert.match(checkoutRoute, /flow_enabled/);
  assert.match(checkoutRoute, /Flow está temporalmente desactivado/);
});

test('Mercado Pago preference remains guest-safe instead of wallet-only', () => {
  const paymentLink = readFileSync(new URL('../src/lib/payments/payment-link.ts', import.meta.url), 'utf8');
  assert.match(paymentLink, /checkout\/preferences/);
  assert.doesNotMatch(paymentLink, /wallet_purchase/);
  assert.doesNotMatch(paymentLink, /purpose\s*:\s*['"]wallet_purchase['"]/);
});

test('canonical option products keep a customer quantity selector', () => {
  const productPanel = readFileSync(new URL('../src/components/tienda/ProductPurchasePanel.tsx', import.meta.url), 'utf8');
  const campaign = readFileSync(new URL('../src/components/tienda/CampaignCatalog.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(productPanel, /const quantity = hasOptionGroups \? 1 : canonicalQty/);
  assert.match(productPanel, /selectionQuantity\s*\*\s*canonicalQty/);
  assert.match(campaign, /selectionQuantity\s*\*\s*quantity/);
});