import assert from 'node:assert/strict';
import test from 'node:test';
import { mapCatalogProductRow } from '../src/lib/catalog/catalog-repository.ts';

const businessUnitId = 'f3b57ce7-0796-40e5-94f1-07cb2b48ba85';

test('mapea variantes, opciones y componentes normalizados del mismo tenant', () => {
  const product = mapCatalogProductRow(businessUnitId, {
    id: 'product-pack-2',
    business_unit_id: businessUnitId,
    slug: 'pack-parrillero-vegano-2',
    nombre: 'Pack Parrillero Vegano 2',
    descripcion: 'Pack de celebración.',
    imagen_url: null,
    activo: true,
    product_variants: [{
      id: 'variant-pack-2', product_id: 'product-pack-2', business_unit_id: businessUnitId,
      sku: 'FP26-PARR-02', name: 'Pack', price: 15000, compare_at_price: null,
      weight_grams: null, units_included: 1, selection_quantity: 0,
      manages_stock: false, stock: null, is_active: true, sort_order: 10, image_url: null,
    }],
    product_option_groups: [],
    product_pack_components: [
      { id: 'component-1', pack_product_id: 'product-pack-2', business_unit_id: businessUnitId, component_product_id: 'seitan', component_name: 'Seitán parrillero', quantity: 400, unit: 'g', weight_grams: 400, sort_order: 10 },
      { id: 'component-2', pack_product_id: 'product-pack-2', business_unit_id: businessUnitId, component_product_id: null, component_name: 'Choripanes veganos', quantity: 5, unit: 'unidades', weight_grams: 300, sort_order: 20 },
    ],
  });

  assert.equal(product?.businessUnitId, businessUnitId);
  assert.equal(product?.variants[0].price, 15000);
  assert.deepEqual(product?.packComponents.map((item) => item.componentName), ['Seitán parrillero', 'Choripanes veganos']);
});

test('ordena variantes, grupos y valores por sort_order', () => {
  const product = mapCatalogProductRow(businessUnitId, {
    id: 'product-empanada', business_unit_id: businessUnitId, slug: 'empanada-del-18', nombre: 'La Empanada del 18',
    descripcion: null, imagen_url: null, activo: true,
    product_variants: [
      { id: 'pack', product_id: 'product-empanada', business_unit_id: businessUnitId, sku: 'PACK', name: 'Pack 10', price: 23900, weight_grams: 2200, units_included: 10, selection_quantity: 10, manages_stock: false, stock: null, is_active: true, sort_order: 20 },
      { id: 'unit', product_id: 'product-empanada', business_unit_id: businessUnitId, sku: 'UNIT', name: 'Unidad', price: 2900, weight_grams: 220, units_included: 1, selection_quantity: 1, manages_stock: false, stock: null, is_active: true, sort_order: 10 },
    ],
    product_option_groups: [{
      id: 'flavors', product_id: 'product-empanada', business_unit_id: businessUnitId, code: 'sabor', name: 'Sabores', selection_mode: 'quantity', is_required: true, is_active: true, sort_order: 10,
      product_option_values: [
        { id: 'napolitana', option_group_id: 'flavors', business_unit_id: businessUnitId, code: 'napolitana', label: 'Napolitana', price_delta: 0, is_active: true, sort_order: 20 },
        { id: 'pino', option_group_id: 'flavors', business_unit_id: businessUnitId, code: 'pino-soya', label: 'Pino de soya', price_delta: 0, is_active: true, sort_order: 10 },
      ],
    }],
    product_pack_components: [],
  });

  assert.deepEqual(product?.variants.map((item) => item.id), ['unit', 'pack']);
  assert.deepEqual(product?.optionGroups[0].values.map((item) => item.id), ['pino', 'napolitana']);
});

test('rechaza una fila de producto de otra business unit', () => {
  const product = mapCatalogProductRow(businessUnitId, {
    id: 'foreign-product',
    business_unit_id: 'another-business',
    slug: 'foreign-product',
    nombre: 'Producto ajeno',
    activo: true,
    product_variants: [],
    product_option_groups: [],
    product_pack_components: [],
  });

  assert.equal(product, null);
});

test('descarta relaciones que no pertenecen al producto o tenant', () => {
  const product = mapCatalogProductRow(businessUnitId, {
    id: 'product-seitan', business_unit_id: businessUnitId, slug: 'seitan-parrillero', nombre: 'Seitán Parrillero', activo: true,
    product_variants: [
      { id: 'valid', product_id: 'product-seitan', business_unit_id: businessUnitId, sku: 'VALID', name: '550 g', price: 6000, weight_grams: 550, units_included: 1, selection_quantity: 0, manages_stock: false, stock: null, is_active: true, sort_order: 10 },
      { id: 'foreign', product_id: 'product-seitan', business_unit_id: 'another-business', sku: 'FOREIGN', name: 'Ajena', price: 1, weight_grams: null, units_included: 1, selection_quantity: 0, manages_stock: false, stock: null, is_active: true, sort_order: 20 },
      { id: 'wrong-product', product_id: 'other-product', business_unit_id: businessUnitId, sku: 'WRONG', name: 'Otro', price: 1, weight_grams: null, units_included: 1, selection_quantity: 0, manages_stock: false, stock: null, is_active: true, sort_order: 30 },
    ],
    product_option_groups: [],
    product_pack_components: [],
  });

  assert.deepEqual(product?.variants.map((item) => item.id), ['valid']);
});
