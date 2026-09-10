import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCatalogLine } from '../src/lib/catalog/selection.ts';
import type { CatalogProduct } from '../src/lib/catalog/types.ts';
import { formatPriceSummary } from '../src/lib/catalog/price-summary.ts';

const mockProteinBalls: CatalogProduct = {
  id: 'prod-pballs-uuid',
  businessUnitId: 'bu-la-manito',
  slug: 'protein-balls',
  name: 'Protein Balls',
  description: 'Protein Balls veganas con cáñamo + mung. Aprox. 4g proteína/unidad.',
  imageUrl: 'https://lamanitodelvegano.cl/products/protein-balls.jpg',
  active: true,
  availabilityDates: [],
  emoji: '🍫',
  color: '#2b1d14',
  sku: 'LMV-PBALL',
  glutenFree: true,
  nutFree: false,
  ingredients: [],
  allergens: ['maní'],
  variants: [
    {
      id: 'var-pball-09',
      productId: 'prod-pballs-uuid',
      sku: 'LMV-PBALL-09',
      name: '9 unidades',
      price: 10900,
      compareAtPrice: null,
      weightGrams: null,
      unitsIncluded: 9,
      selectionQuantity: 9,
      managesStock: false,
      stock: null,
      active: true,
      sortOrder: 10,
      imageUrl: null,
    },
    {
      id: 'var-pball-15',
      productId: 'prod-pballs-uuid',
      sku: 'LMV-PBALL-15',
      name: '15 unidades',
      price: 15900,
      compareAtPrice: null,
      weightGrams: null,
      unitsIncluded: 15,
      selectionQuantity: 15,
      managesStock: false,
      stock: null,
      active: true,
      sortOrder: 20,
      imageUrl: null,
    },
    {
      id: 'var-pball-24',
      productId: 'prod-pballs-uuid',
      sku: 'LMV-PBALL-24',
      name: '24 unidades',
      price: 19900,
      compareAtPrice: null,
      weightGrams: null,
      unitsIncluded: 24,
      selectionQuantity: 24,
      managesStock: false,
      stock: null,
      active: true,
      sortOrder: 30,
      imageUrl: null,
    },
  ],
  optionGroups: [
    {
      id: 'opt-pballs-sabores',
      productId: 'prod-pballs-uuid',
      code: 'sabores',
      name: 'Sabores',
      selectionMode: 'quantity',
      required: true,
      active: true,
      sortOrder: 10,
      values: [
        { id: 'val-pb-1', optionGroupId: 'opt-pballs-sabores', code: 'naranja-cacao', label: 'Naranja confitada + cacao', priceDelta: 0, active: true, sortOrder: 10 },
        { id: 'val-pb-2', optionGroupId: 'opt-pballs-sabores', code: 'caramelo-mani', label: 'Caramelo salado + maní', priceDelta: 0, active: true, sortOrder: 20 },
        { id: 'val-pb-3', optionGroupId: 'opt-pballs-sabores', code: 'manzana-canela-bitter', label: 'Manzana confitada + canela + chocolate bitter', priceDelta: 0, active: true, sortOrder: 30 },
      ],
    },
  ],
  packComponents: [],
};

const mockAlfajores: CatalogProduct = {
  id: 'prod-alf-uuid',
  businessUnitId: 'bu-la-manito',
  slug: 'alfajores-canamo',
  name: 'Alfajores de Cáñamo',
  description: 'Alfajores veganos proteicos de cáñamo, 60g, 13g proteína.',
  imageUrl: 'https://lamanitodelvegano.cl/products/alfajores-canamo.jpg',
  active: true,
  availabilityDates: [],
  emoji: '🍪',
  color: '#233221',
  sku: 'LMV-ALF-HEMP',
  glutenFree: true,
  nutFree: false,
  ingredients: [],
  allergens: [],
  variants: [
    {
      id: 'var-alf-01',
      productId: 'prod-alf-uuid',
      sku: 'LMV-ALF-HEMP-01',
      name: '1 unidad',
      price: 3500,
      compareAtPrice: null,
      weightGrams: 60,
      unitsIncluded: 1,
      selectionQuantity: 1,
      managesStock: false,
      stock: null,
      active: true,
      sortOrder: 10,
      imageUrl: null,
    },
    {
      id: 'var-alf-04',
      productId: 'prod-alf-uuid',
      sku: 'LMV-ALF-HEMP-04',
      name: 'Pack 4',
      price: 11900,
      compareAtPrice: null,
      weightGrams: 240,
      unitsIncluded: 4,
      selectionQuantity: 4,
      managesStock: false,
      stock: null,
      active: true,
      sortOrder: 20,
      imageUrl: null,
    },
  ],
  optionGroups: [
    {
      id: 'opt-alf-sabores',
      productId: 'prod-alf-uuid',
      code: 'sabores',
      name: 'Rellenos / Sabores',
      selectionMode: 'quantity',
      required: true,
      active: true,
      sortOrder: 10,
      values: [
        { id: 'val-alf-1', optionGroupId: 'opt-alf-sabores', code: 'manjar-canamo', label: 'Manjar de cáñamo', priceDelta: 0, active: true, sortOrder: 10 },
        { id: 'val-alf-2', optionGroupId: 'opt-alf-sabores', code: 'pistacho-dubai', label: 'Pistacho Dubái', priceDelta: 0, active: true, sortOrder: 20 },
      ],
    },
  ],
  packComponents: [],
};

const mockBarraDubai: CatalogProduct = {
  id: 'prod-dubai-uuid',
  businessUnitId: 'bu-la-manito',
  slug: 'barra-dubai',
  name: 'Barra Dubái',
  description: 'Chocolate vegano relleno de crema de pistacho y kunafa crujiente.',
  imageUrl: 'https://lamanitodelvegano.cl/products/barra-dubai.jpg',
  active: true,
  availabilityDates: [],
  emoji: '🍫',
  color: '#1e3522',
  sku: 'LMV-DUBAI',
  glutenFree: false,
  nutFree: false,
  ingredients: [],
  allergens: [],
  variants: [
    {
      id: 'var-dubai-120g',
      productId: 'prod-dubai-uuid',
      sku: 'LMV-DUBAI-120G',
      name: '120 g',
      price: 10900,
      compareAtPrice: 12900,
      weightGrams: 120,
      unitsIncluded: 1,
      selectionQuantity: 0,
      managesStock: false,
      stock: null,
      active: true,
      sortOrder: 10,
      imageUrl: null,
    },
    {
      id: 'var-dubai-240g',
      productId: 'prod-dubai-uuid',
      sku: 'LMV-DUBAI-240G',
      name: '240 g',
      price: 18900,
      compareAtPrice: 21900,
      weightGrams: 240,
      unitsIncluded: 1,
      selectionQuantity: 0,
      managesStock: false,
      stock: null,
      active: true,
      sortOrder: 20,
      imageUrl: null,
    },
  ],
  optionGroups: [],
  packComponents: [],
};

test('15 Protein Balls repartidas 5+5+5 cobran exactamente $15.900 (precio caja único)', () => {
  const result = resolveCatalogLine(mockProteinBalls, {
    productId: 'prod-pballs-uuid',
    variantId: 'var-pball-15',
    quantity: 1,
    selections: [
      { optionValueId: 'val-pb-1', quantity: 5 },
      { optionValueId: 'val-pb-2', quantity: 5 },
      { optionValueId: 'val-pb-3', quantity: 5 },
    ],
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.line.unitPrice, 15900);
    assert.equal(result.line.lineTotal, 15900);
    assert.equal(result.line.variantSku, 'LMV-PBALL-15');
    assert.equal(result.line.selections.length, 3);
  }
});

test('Protein Balls falla si la suma de sabores no coincide con selection_quantity (15)', () => {
  const resultIncomplete = resolveCatalogLine(mockProteinBalls, {
    productId: 'prod-pballs-uuid',
    variantId: 'var-pball-15',
    quantity: 1,
    selections: [
      { optionValueId: 'val-pb-1', quantity: 5 },
      { optionValueId: 'val-pb-2', quantity: 5 },
      { optionValueId: 'val-pb-3', quantity: 4 }, // total 14 != 15
    ],
  });
  assert.equal(resultIncomplete.ok, false);
  if (!resultIncomplete.ok) {
    assert.equal(resultIncomplete.error, 'selection_quantity_mismatch');
  }

  const resultExcess = resolveCatalogLine(mockProteinBalls, {
    productId: 'prod-pballs-uuid',
    variantId: 'var-pball-15',
    quantity: 1,
    selections: [
      { optionValueId: 'val-pb-1', quantity: 6 },
      { optionValueId: 'val-pb-2', quantity: 5 },
      { optionValueId: 'val-pb-3', quantity: 5 }, // total 16 != 15
    ],
  });
  assert.equal(resultExcess.ok, false);
  if (!resultExcess.ok) {
    assert.equal(resultExcess.error, 'selection_quantity_mismatch');
  }
});

test('Pack 4 Alfajores de Cáñamo con mezcla 2+2 cuesta exactamente $11.900', () => {
  const result = resolveCatalogLine(mockAlfajores, {
    productId: 'prod-alf-uuid',
    variantId: 'var-alf-04',
    quantity: 1,
    selections: [
      { optionValueId: 'val-alf-1', quantity: 2 },
      { optionValueId: 'val-alf-2', quantity: 2 },
    ],
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.line.unitPrice, 11900);
    assert.equal(result.line.lineTotal, 11900);
    assert.equal(result.line.variantSku, 'LMV-ALF-HEMP-04');
  }
});

test('Alfajor 1 unidad cuesta $3.500 al seleccionar 1 sabor', () => {
  const result = resolveCatalogLine(mockAlfajores, {
    productId: 'prod-alf-uuid',
    variantId: 'var-alf-01',
    quantity: 1,
    selections: [
      { optionValueId: 'val-alf-1', quantity: 1 },
    ],
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.line.unitPrice, 3500);
    assert.equal(result.line.lineTotal, 3500);
    assert.equal(result.line.variantSku, 'LMV-ALF-HEMP-01');
  }
});

test('Barra Dubái 120 g ($10.900) vs 240 g ($18.900) calculan correctamente sin selector de sabores', () => {
  const result120 = resolveCatalogLine(mockBarraDubai, {
    productId: 'prod-dubai-uuid',
    variantId: 'var-dubai-120g',
    quantity: 2,
    selections: [],
  });
  assert.equal(result120.ok, true);
  if (result120.ok) {
    assert.equal(result120.line.unitPrice, 10900);
    assert.equal(result120.line.lineTotal, 21800);
    assert.equal(result120.line.variantSku, 'LMV-DUBAI-120G');
  }

  const result240 = resolveCatalogLine(mockBarraDubai, {
    productId: 'prod-dubai-uuid',
    variantId: 'var-dubai-240g',
    quantity: 1,
    selections: [],
  });
  assert.equal(result240.ok, true);
  if (result240.ok) {
    assert.equal(result240.line.unitPrice, 18900);
    assert.equal(result240.line.lineTotal, 18900);
    assert.equal(result240.line.variantSku, 'LMV-DUBAI-240G');
  }
});

test('formatPriceSummary muestra correctamente el resumen de precios y variantes de Barra Dubái', () => {
  const summary = formatPriceSummary({
    precio: 10900,
    variants: [
      { id: '1', name: '120 g', price: 10900, active: true },
      { id: '2', name: '240 g', price: 18900, active: true },
    ],
  });
  assert.equal(summary.displayPrice, 10900);
  assert.equal(summary.formattedDisplayPrice, '$10.900');
  assert.ok(summary.packSummary);
});
