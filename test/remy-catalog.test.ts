import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRemyCartAddition, catalogLookupInstruction, matchesCatalogQuery, toRemyCatalogProduct } from '../src/lib/catalog/remy-catalog.ts';
import { attachPackComponentOptions } from '../src/lib/catalog/catalog-repository.ts';
import type { CatalogProduct } from '../src/lib/catalog/types.ts';

const adoboGroup = {
  id: 'adobo', productId: 'kostilles', code: 'adobo', name: 'Adobo', selectionMode: 'single' as const,
  required: true, active: true, sortOrder: 10,
  values: [
    { id: 'bbq', optionGroupId: 'adobo', code: 'barbecue', label: 'Barbecue', priceDelta: 0, active: true, sortOrder: 10 },
    { id: 'mostaza', optionGroupId: 'adobo', code: 'mostaza', label: 'Mostaza', priceDelta: 0, active: true, sortOrder: 20 },
  ],
};

const pack: CatalogProduct = {
  id: 'pack2', businessUnitId: 'business', slug: 'pack-parrillero-vegano-2', name: 'Pack Parrillero Vegano 2',
  description: 'Pack para el 18.', imageUrl: null, active: true, availabilityDates: ['2026-09-15'],
  variants: [{ id: 'variant', productId: 'pack2', sku: 'FP26-PARR-02', name: 'Pack', price: 15000, weightGrams: null, unitsIncluded: 1, selectionQuantity: 0, managesStock: false, stock: null, active: true, sortOrder: 10 }],
  optionGroups: [], packComponents: [{ id: 'kost', componentProductId: 'kostilles', componentName: 'Le Kostilles al vacío', quantity: 1, unit: 'pack', weightGrams: null, sortOrder: 10 }],
};

const kostilles: CatalogProduct = {
  id: 'kostilles', businessUnitId: 'business', slug: 'le-kostilles', name: 'Le Kostilles', description: null,
  imageUrl: null, active: true, variants: [], optionGroups: [adoboGroup], packComponents: [],
};

test('Remy encuentra por campaña o componente y devuelve precio desde la variante', () => {
  assert.equal(matchesCatalogQuery(pack, 'qué tienen para el 18'), true);
  assert.equal(matchesCatalogQuery({ ...pack, description: 'Pack parrillero vegano.' }, 'qué tienen para el 18', ['Fiestas Patrias 2026']), true);
  assert.equal(matchesCatalogQuery(pack, 'incluye kostilles'), true);
  const dto = toRemyCatalogProduct(pack);
  assert.equal(dto.variants[0].price, 15000);
  assert.equal(dto.components[0].name, 'Le Kostilles al vacío');
  assert.deepEqual(dto.deliveryDates, ['2026-09-15']);
});

test('Remy receives options inherited from a linked pack component', () => {
  const [enriched] = attachPackComponentOptions([pack, kostilles]);
  const dto = toRemyCatalogProduct(enriched);
  assert.equal(dto.components[0].options[0].name, 'Adobo');
  assert.deepEqual(dto.components[0].options[0].values.map((value) => value.label), ['Barbecue', 'Mostaza']);
});

test('la respuesta comercial obliga a usar el resultado verificado', () => {
  const instruction = catalogLookupInstruction({ products: [{ name: 'La Empanada del 18' }] });
  assert.match(instruction, /CATÁLOGO MASTER VERIFICADO/);
  assert.match(instruction, /La Empanada del 18/);
  assert.match(instruction, /No inventes/);
});

test('Remy agrega la variante usando el precio canónico del catálogo', () => {
  const result = buildRemyCartAddition(pack, {
    productId: pack.id,
    variantId: pack.variants[0].id,
    quantity: 2,
    campaignTag: 'fiestas-patrias-2026',
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.item.precio, 15000);
  assert.equal(result.item.qty, 2);
  assert.equal(result.item.variantId, 'variant');
  assert.equal(result.item.campaignTag, 'fiestas-patrias-2026');
});
