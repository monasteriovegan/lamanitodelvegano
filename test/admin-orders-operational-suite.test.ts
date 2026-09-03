import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { formatPriceSummary } from '../src/lib/catalog/price-summary.ts';
import { resolveCatalogLine } from '../src/lib/catalog/selection.ts';
import type { CatalogProduct } from '../src/lib/catalog/types.ts';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

test('WhatsApp status isolation: messages endpoint strictly excludes status:* rows', () => {
  const messagesApi = read('src/app/api/admin/conversations/[id]/messages/route.ts');
  assert.match(messagesApi, /not\('message_type',\s*'like',\s*'status:%'\)/);
});

test('WhatsApp status isolation: messages processor drops status:* orphan messages', () => {
  const msgProcessor = read('src/lib/messaging/messages.ts');
  assert.match(msgProcessor, /message\.message_type\.startsWith\('status:'\)/);
  assert.match(msgProcessor, /duplicate:\s*true/);
});

test('Order model: includes notes, admin_notes, and print tracking fields', () => {
  const domainTypes = read('src/types/domain.ts');
  assert.match(domainTypes, /notes\?:\s*string\s*\|\s*null/);
  assert.match(domainTypes, /admin_notes\?:\s*string\s*\|\s*null/);
  assert.match(domainTypes, /printed_at\?:\s*string\s*\|\s*null/);
  assert.match(domainTypes, /last_printed_at\?:\s*string\s*\|\s*null/);
  assert.match(domainTypes, /print_count\?:\s*number/);
});

test('OrderRepository: update method handles admin_notes, notes, print_action, and decoupled CRM update', () => {
  const orderRepo = read('src/lib/repositories/orders-repository.ts');
  assert.match(orderRepo, /update\.admin_notes/);
  assert.match(orderRepo, /update\.notas/);
  assert.match(orderRepo, /input\.print_action\s*===\s*'mark_printed'/);
  assert.match(orderRepo, /input\.print_action\s*===\s*'reset_print'/);
  assert.match(orderRepo, /input\.update_crm\s*&&\s*before\.customer_id/);
});

test('Pack Selection: validates exact quantity match for pack of 10 empanadas', () => {
  const product: CatalogProduct = {
    id: 'prod-emp-18',
    businessUnitId: 'bu-test',
    slug: 'empanada-del-18',
    name: 'La Empanada del 18',
    description: 'Empanadas artesanales',
    imageUrl: null,
    active: true,
    availabilityDates: [],
    variants: [
      {
        id: 'var-pack10',
        productId: 'prod-emp-18',
        sku: 'FP26-EMP-PACK10',
        name: 'Pack 10',
        price: 23900,
        compareAtPrice: null,
        weightGrams: 2200,
        unitsIncluded: 10,
        selectionQuantity: 10,
        managesStock: false,
        stock: null,
        active: true,
        sortOrder: 1,
        imageUrl: null,
      },
    ],
    optionGroups: [
      {
        id: 'group-sabor',
        productId: 'prod-emp-18',
        code: 'sabor',
        name: 'Sabores',
        selectionMode: 'quantity',
        required: true,
        active: true,
        sortOrder: 1,
        values: [
          { id: 'val-pino-soya', optionGroupId: 'group-sabor', code: 'pino-soya', label: 'Pino de soya', priceDelta: 0, active: true, sortOrder: 1 },
          { id: 'val-napolitana', optionGroupId: 'group-sabor', code: 'napolitana', label: 'Napolitana', priceDelta: 0, active: true, sortOrder: 2 },
        ],
      },
    ],
    packComponents: [],
  };

  // Valid 5 + 5 = 10
  const validResult = resolveCatalogLine(product, {
    productId: 'prod-emp-18',
    variantId: 'var-pack10',
    quantity: 1,
    selections: [
      { optionValueId: 'val-pino-soya', quantity: 5 },
      { optionValueId: 'val-napolitana', quantity: 5 },
    ],
  });
  assert.equal(validResult.ok, true);
  if (validResult.ok) {
    assert.equal(validResult.line.selections.length, 2);
    assert.equal(validResult.line.lineTotal, 23900);
  }

  // Invalid 4 + 5 = 9 (mismatch with selectionQuantity 10)
  const invalidResult = resolveCatalogLine(product, {
    productId: 'prod-emp-18',
    variantId: 'var-pack10',
    quantity: 1,
    selections: [
      { optionValueId: 'val-pino-soya', quantity: 4 },
      { optionValueId: 'val-napolitana', quantity: 5 },
    ],
  });
  assert.equal(invalidResult.ok, false);
  if (!invalidResult.ok) {
    assert.equal(invalidResult.error, 'selection_quantity_mismatch');
  }
});

test('Price summary helper: correctly formats structured pack prices and discounts', () => {
  const prodWithPack = {
    id: '1',
    nombre: 'La Empanada del 18',
    precio: 2900,
    variants: [
      { id: 'v1', name: 'Unidad', price: 2900, selectionQuantity: 1 },
      { id: 'v2', name: 'Pack 10', price: 23900, selectionQuantity: 10 },
    ],
  };
  const summary = formatPriceSummary(prodWithPack as any);
  assert.equal(summary.formattedDisplayPrice, '$2.900');
  assert.equal(summary.packSummary, '1 por $2.900 · 10 por $23.900');

  const prodWithDiscount = {
    id: '2',
    nombre: 'Bombones',
    precio: 19900,
    precio_anterior: 22900,
  };
  const discountSummary = formatPriceSummary(prodWithDiscount as any);
  assert.equal(discountSummary.formattedDisplayPrice, '$19.900');
  assert.equal(discountSummary.formattedOriginalPrice, '$22.900');
});

test('Print template in OrderActions: renders clean customer receipt on top and cut-off internal section on bottom', () => {
  const actions = read('src/app/admin/pedidos/[id]/OrderActions.tsx');
  assert.match(actions, /customer-zone/);
  assert.match(actions, /cut-off-line/);
  assert.match(actions, /internal-zone/);
  assert.match(actions, /RECORTAR AQUÍ/);
  assert.match(actions, /mark_printed/);
});

test('Admin Navigation: includes Operación, Wonka / Inteligencia, and Configuración with Catálogo Master', () => {
  const sidebar = read('src/app/admin/AdminSidebar.tsx');
  assert.match(sidebar, /Catálogo Master/);
  assert.match(sidebar, /Canales & Precios/);
  assert.match(sidebar, /Wonka \/ Inteligencia/);
  assert.match(sidebar, /Operación/);
});
