import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { toRemyCatalogProduct } from '../src/lib/catalog/remy-catalog.ts';
import { toPublicCatalogProduct } from '../src/lib/catalog/public-dto.ts';
import { buildMetaFeedItem, serializeMetaCatalogCsv } from '../src/lib/meta/catalog-feed.ts';
import { resolveCatalogCheckoutItem } from '../src/lib/catalog/catalog-checkout.ts';
import type { CatalogProduct } from '../src/lib/catalog/types.ts';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

test('Admin Master Audit: ProductoForm implements tri-state dietary selects without boolean coercion', () => {
  const formCode = read('src/app/admin/productos/ProductoForm.tsx');
  assert.match(formCode, /name="gluten_free"/);
  assert.match(formCode, /name="nut_free"/);
  assert.match(formCode, /Sin verificar \/ no afirmar \(null\)/);
  assert.match(formCode, /Verificado libre de gluten \(true\)/);
  assert.match(formCode, /Contiene gluten \/ no apto \(false\)/);

  const actionsCode = read('src/app/admin/productos/actions.ts');
  assert.match(actionsCode, /function parseTriState/);
  assert.match(actionsCode, /gluten_free:\s*parseTriState\(formData\.get\('gluten_free'\)\)/);
  assert.match(actionsCode, /nut_free:\s*parseTriState\(formData\.get\('nut_free'\)\)/);
});

test('Admin Master Audit: Admin Products API route supports tri-state attributes in GET, POST, and PUT', () => {
  const routeCode = read('src/app/api/admin/products/route.ts');
  assert.match(routeCode, /gluten_free:\s*p\.gluten_free/);
  assert.match(routeCode, /nut_free:\s*p\.nut_free/);
  assert.match(routeCode, /gluten_free:\s*body\.gluten_free/);
  assert.match(routeCode, /nut_free:\s*body\.nut_free/);

  const idRouteCode = read('src/app/api/admin/products/[id]/route.ts');
  assert.match(idRouteCode, /gluten_free:\s*data\.gluten_free/);
  assert.match(idRouteCode, /nut_free:\s*data\.nut_free/);
  assert.match(idRouteCode, /payload\.gluten_free\s*=\s*parseTriState\(body\.gluten_free\)/);
  assert.match(idRouteCode, /payload\.nut_free\s*=\s*parseTriState\(body\.nut_free\)/);
});

test('Admin Master Audit: Server-side Checkout validates price and ignores fraudulent clientPrice', () => {
  const mockProduct: CatalogProduct = {
    id: 'prod-100',
    businessUnitId: 'bu-1',
    slug: 'empanada-del-18',
    name: 'La Empanada del 18',
    description: 'Empanada artesanal',
    imageUrl: 'https://example.com/emp.jpg',
    active: true,
    sku: 'FP26-EMP',
    glutenFree: false,
    nutFree: null,
    availabilityDates: [],
    variants: [
      {
        id: 'var-100',
        productId: 'prod-100',
        sku: 'FP26-EMP-UNIT',
        name: 'Unidad',
        price: 2900,
        compareAtPrice: null,
        weightGrams: 220,
        unitsIncluded: 1,
        selectionQuantity: 0,
        managesStock: false,
        stock: null,
        active: true,
        sortOrder: 10,
      },
    ],
    optionGroups: [
      {
        id: 'grp-sabor',
        productId: 'prod-100',
        code: 'sabor',
        name: 'Sabor',
        selectionMode: 'single',
        required: true,
        active: true,
        sortOrder: 10,
        values: [
          {
            id: 'val-pino',
            optionGroupId: 'grp-sabor',
            code: 'pino',
            label: 'Pino Soya',
            priceDelta: 0,
            active: true,
            sortOrder: 10,
          },
        ],
      },
    ],
    packComponents: [],
  };

  const intent = {
    productoId: 'prod-100',
    variantId: 'var-100',
    qty: 2,
    clientPrice: 100,
    selections: [{ optionValueId: 'val-pino', quantity: 1 }],
  };

  const resolved = resolveCatalogCheckoutItem(mockProduct, intent);
  assert.equal(resolved.ok, true);
  if (resolved.ok) {
    assert.equal(resolved.item.precio, 2900);
    assert.equal(resolved.item.qty, 2);
  }
});

test('Admin Master Audit: Pack components maintain parent price integrity', () => {
  const packProduct: CatalogProduct = {
    id: 'pack-parr-1',
    businessUnitId: 'bu-1',
    slug: 'pack-parrillero-vegano-1',
    name: 'Pack Parrillero Vegano 1',
    description: 'Pack parrillero dieciochero',
    imageUrl: 'https://example.com/pack1.jpg',
    active: true,
    sku: 'FP26-PARR-01',
    glutenFree: false,
    nutFree: null,
    availabilityDates: [],
    variants: [
      {
        id: 'v-pack1',
        productId: 'pack-parr-1',
        sku: 'FP26-PARR-01',
        name: 'Pack estándar',
        price: 11900,
        compareAtPrice: null,
        weightGrams: 1500,
        unitsIncluded: 1,
        selectionQuantity: 0,
        managesStock: false,
        stock: null,
        active: true,
        sortOrder: 10,
      },
    ],
    optionGroups: [],
    packComponents: [
      { id: 'c-1', componentProductId: 'seitan', componentName: 'Seitán parrillero', quantity: 400, unit: 'g', weightGrams: 400, sortOrder: 10 },
      { id: 'c-2', componentProductId: null, componentName: 'Choripanes veganos', quantity: 5, unit: 'unidades', weightGrams: 500, sortOrder: 20 },
      { id: 'c-3', componentProductId: null, componentName: 'Burgers parrilleras', quantity: 3, unit: 'unidades', weightGrams: 300, sortOrder: 30 },
    ],
  };

  const remy = toRemyCatalogProduct(packProduct);
  const web = toPublicCatalogProduct(packProduct);
  const feed = buildMetaFeedItem({
    product: { slug: packProduct.slug, name: packProduct.name, description: packProduct.description, imageUrl: packProduct.imageUrl },
    variant: packProduct.variants[0],
  });

  assert.equal(remy.variants[0].price, 11900);
  assert.equal(web.variants[0].price, 11900);
  assert.equal(feed.price, '11900 CLP');
  assert.equal(feed.id, 'FP26-PARR-01');
  assert.equal(remy.components.length, 3);
  assert.equal(web.packComponents.length, 3);
});

test('Admin Master Audit: Meta Feed serialization uses canonical variant SKU as retailer_id', () => {
  const items = [
    buildMetaFeedItem({
      product: { slug: 'empanada-del-18', name: 'La Empanada del 18', description: 'Empanada', imageUrl: 'https://example.com/emp.jpg' },
      variant: { id: 'v1', sku: 'FP26-EMP-UNIT', name: 'Unidad', price: 2900, stock: null, managesStock: false },
    }),
    buildMetaFeedItem({
      product: { slug: 'pack-parrillero-vegano-1', name: 'Pack Parrillero Vegano 1', description: 'Pack 1', imageUrl: 'https://example.com/p1.jpg' },
      variant: { id: 'v2', sku: 'FP26-PARR-01', name: 'Pack', price: 11900, stock: null, managesStock: false },
    }),
  ];

  const csv = serializeMetaCatalogCsv(items);
  assert.match(csv, /id,title,description,availability,condition,price,link,image_link,brand/);
  assert.match(csv, /"FP26-EMP-UNIT"/);
  assert.match(csv, /"FP26-PARR-01"/);
  assert.match(csv, /"2900 CLP"/);
  assert.match(csv, /"11900 CLP"/);
});

test('Admin Master Audit: Image upload endpoint validates formats, size and returns public URLs', () => {
  const uploadCode = read('src/app/api/admin/upload/route.ts');
  assert.match(uploadCode, /5\s*\*\s*1024\s*\*\s*1024/);
  assert.match(uploadCode, /\['jpg',\s*'jpeg',\s*'png',\s*'webp',\s*'gif',\s*'avif'\]/);
  assert.match(uploadCode, /getPublicUrl/);
});
