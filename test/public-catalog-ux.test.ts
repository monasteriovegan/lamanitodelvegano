import assert from 'node:assert/strict';
import test from 'node:test';

import {
  featuredProductMediaLayout,
  filterProductsByCatalogCategory,
  publicCatalogCategories,
} from '../src/lib/catalog/public-categories.ts';

const products = [
  { id: '1', slug: 'pack-parrillero-vegano-1', categoria: 'Proteínas veganas' },
  { id: '2', slug: 'lomo-lyse', categoria: null },
  { id: '3', slug: 'barra-dubai', categoria: 'Chocolatería premium' },
  { id: '4', slug: 'alfajores-canamo', categoria: 'Dulces proteicos' },
  { id: '5', slug: 'box-rollitos-canela', categoria: 'Dulces y pastelería' },
  { id: '6', slug: 'postres-en-frascos', categoria: null },
  { id: '7', slug: 'empanada-del-18', categoria: 'Empanadas' },
];

test('public catalog consolidates aliases and uncategorized products into four useful categories', () => {
  assert.deepEqual(
    publicCatalogCategories(products).map((category) => category.nombre),
    ['Proteínas veganas', 'Chocolatería y dulces', 'Pastelería', 'Empanadas y pizzas'],
  );
});

test('category filters include legacy aliases and known uncategorized products', () => {
  assert.deepEqual(
    filterProductsByCatalogCategory(products, 'Proteínas veganas').map((product) => product.id),
    ['1', '2'],
  );
  assert.deepEqual(
    filterProductsByCatalogCategory(products, 'Chocolatería y dulces').map((product) => product.id),
    ['3', '4'],
  );
  assert.deepEqual(
    filterProductsByCatalogCategory(products, 'Pastelería').map((product) => product.id),
    ['5', '6'],
  );
  assert.deepEqual(
    filterProductsByCatalogCategory(products, 'Empanadas y pizzas').map((product) => product.id),
    ['7'],
  );
});

test('featured product media uses the portrait ratio and never crops its image', () => {
  const layout = featuredProductMediaLayout();
  assert.match(layout.containerClassName, /aspect-\[4\/5\]/);
  assert.match(layout.imageClassName, /object-contain/);
  assert.doesNotMatch(layout.imageClassName, /object-cover/);
});
