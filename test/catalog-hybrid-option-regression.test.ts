import test from 'node:test';
import assert from 'node:assert/strict';
import { mapCatalogProductRow } from '../src/lib/catalog/catalog-repository.ts';

const BUSINESS_ID = 'f3b57ce7-0796-40e5-94f1-07cb2b48ba85';
const PRODUCT_ID = '11111111-1111-4111-8111-111111111111';

test('canonical variants do not synthesize hidden required option groups from legacy variedades', () => {
  const product = mapCatalogProductRow(BUSINESS_ID, {
    id: PRODUCT_ID,
    business_unit_id: BUSINESS_ID,
    slug: 'pack-parrillero-vegano-2',
    nombre: 'Pack Parrillero Vegano 2',
    descripcion: null,
    precio: 15000,
    sku: 'FP26-PARR-02',
    activo: true,
    variedades: 'variedades kostilles:barabacue,mostaza finas hierbas,criollo picante',
    product_variants: [
      {
        id: '22222222-2222-4222-8222-222222222222',
        business_unit_id: BUSINESS_ID,
        product_id: PRODUCT_ID,
        sku: 'FP26-PARR-02',
        name: 'Pack',
        price: 15000,
        units_included: 1,
        selection_quantity: 0,
        manages_stock: false,
        stock: null,
        is_active: true,
        sort_order: 10,
      },
    ],
    product_option_groups: [],
    product_pack_components: [],
  });

  assert.ok(product);
  assert.equal(product.variants.length, 1);
  assert.deepEqual(product.optionGroups, []);
});
