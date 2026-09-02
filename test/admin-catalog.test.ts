import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCatalogAdminUpdate } from '../src/lib/catalog/admin-catalog.ts';

test('admin solo acepta precio entero y flags de canal explícitos', () => {
  assert.deepEqual(parseCatalogAdminUpdate({
    productId: 'product', variantId: 'variant', price: 23900,
    visibleWeb: false, visibleWhatsapp: true, ignored: 'secret',
  }), {
    productId: 'product', variantId: 'variant', price: 23900,
    visibleWeb: false, visibleWhatsapp: true,
  });
  assert.throws(() => parseCatalogAdminUpdate({ productId: 'product', price: -1 }), /invalid_price/);
});
