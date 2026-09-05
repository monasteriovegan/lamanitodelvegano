import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { buildMetaFeedItem } from '../src/lib/meta/catalog-feed.ts';

test('feed usa SKU, precio CLP y URL canónica', () => {
  const item = buildMetaFeedItem({
    product: { slug: 'seitan-parrillero', name: 'Seitán Parrillero', description: 'Seitán vegano', imageUrl: 'https://lamanitodelvegano.cl/seitan.webp' },
    variant: { id: 'v', sku: 'FP26-SEITAN-1KG', name: '1 kg', price: 9900, stock: null, managesStock: false },
  });
  assert.equal(item.id, 'FP26-SEITAN-1KG');
  assert.equal(item.price, '9900 CLP');
  assert.equal(item.link, 'https://lamanitodelvegano.cl/productos/seitan-parrillero?variant=FP26-SEITAN-1KG');
});

test('Meta y WhatsApp usan la imagen principal del Catálogo Master antes que una imagen vieja de variante', () => {
  const route = readFileSync('src/app/api/meta/catalog/feed/route.ts', 'utf8');
  assert.match(route, /imageUrl:\s*product\.imageUrl\s*\|\|\s*variant\.imageUrl/);
  assert.doesNotMatch(route, /imageUrl:\s*variant\.imageUrl\s*\|\|\s*product\.imageUrl/);
});
