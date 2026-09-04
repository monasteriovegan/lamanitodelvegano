import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { resolveCatalogLine } from '../src/lib/catalog/selection.ts';
import { formatPriceSummary } from '../src/lib/catalog/price-summary.ts';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

// WhatsApp statuses should never pollute conversation message streams.
test('WhatsApp status isolation: messages endpoint strictly excludes status:* rows', () => {
  const route = read('src/app/api/admin/conversations/[id]/messages/route.ts');
  assert.match(route, /\.not\('provider_message_id',\s*'like',\s*'status:%'\)/);
});

test('WhatsApp status isolation: messages processor drops status:* orphan messages', () => {
  const processor = read('src/lib/messaging/process-message.ts');
  assert.match(processor, /providerMessageId\.startsWith\('status:'\)/);
});

// Order model keeps customer-facing notes separate from internal notes and print metadata.
test('Order model: includes notes, admin_notes, and print tracking fields', () => {
  const domain = read('src/types/domain.ts');
  assert.match(domain, /notes\?: string \| null/);
  assert.match(domain, /admin_notes\?: string \| null/);
  assert.match(domain, /print_count\?: number/);
  assert.match(domain, /last_printed_at\?: string \| null/);
});

test('OrderRepository: update method handles admin_notes, notes, print_action, and decoupled CRM update', () => {
  const repo = read('src/lib/repositories/orders-repository.ts');
  assert.match(repo, /admin_notes\?: string/);
  assert.match(repo, /notes\?: string/);
  assert.match(repo, /print_action\?: 'mark_printed' \| 'reset_print'/);
  assert.match(repo, /update_crm\?: boolean/);
  assert.match(repo, /input\.print_action === 'mark_printed'/);
});

const EMP_PRODUCT: any = {
  id: 'p1', businessUnitId: 'b1', slug: 'empanadas', name: 'Empanadas', description: null, imageUrl: null, active: true,
  variants: [{ id: 'v10', productId: 'p1', sku: 'EMP10', name: 'Pack 10', price: 23900, compareAtPrice: null, weightGrams: null, unitsIncluded: 10, selectionQuantity: 10, managesStock: false, stock: null, active: true, sortOrder: 0 }],
  optionGroups: [{
    id: 'g1', productId: 'p1', code: 'sabores', name: 'Sabores', selectionMode: 'quantity', required: true, active: true, sortOrder: 0,
    values: [
      { id: 'a', optionGroupId: 'g1', code: 'pino', label: 'Pino', priceDelta: 0, active: true, sortOrder: 0 },
      { id: 'b', optionGroupId: 'g1', code: 'choclo', label: 'Choclo', priceDelta: 0, active: true, sortOrder: 1 },
    ],
  }],
  packComponents: [],
};

test('Pack Selection: validates exact quantity match for pack of 10 empanadas', () => {
  const good = resolveCatalogLine(EMP_PRODUCT, {
    productId: 'p1', variantId: 'v10', quantity: 1,
    selections: [{ optionValueId: 'a', quantity: 5 }, { optionValueId: 'b', quantity: 5 }],
  });
  assert.equal(good.ok, true);

  const bad = resolveCatalogLine(EMP_PRODUCT, {
    productId: 'p1', variantId: 'v10', quantity: 1,
    selections: [{ optionValueId: 'a', quantity: 4 }, { optionValueId: 'b', quantity: 5 }],
  });
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.equal(bad.error, 'selection_quantity_mismatch');
});

test('Price summary helper: correctly formats structured pack prices and discounts', () => {
  const product = {
    precio: 2900,
    precio_anterior: null,
    variants: [
      { id: 'unit', name: 'Unidad', price: 2900, selectionQuantity: 1, active: true },
      { id: 'pack', name: 'Pack 10', price: 23900, selectionQuantity: 10, active: true },
    ],
  };
  const packSummary = formatPriceSummary(product as any);
  assert.equal(packSummary.formattedDisplayPrice, '$2.900');
  assert.match(packSummary.packSummary || '', /1 por \$2\.900/);
  assert.match(packSummary.packSummary || '', /10 por \$23\.900/);

  const prodWithDiscount = { precio: 22900, precio_anterior: null, precio_oferta: 19900 };
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

test('Admin Navigation: keeps Operación and intelligence while grouping reusable catalog tools', () => {
  const sidebar = read('src/app/admin/AdminSidebar.tsx');
  assert.match(sidebar, /Catálogo Master/);
  assert.match(sidebar, /Temporadas & Colecciones/);
  assert.doesNotMatch(sidebar, /Canales & Precios/);
  assert.match(sidebar, /Wonka \/ Inteligencia/);
  assert.match(sidebar, /Operación/);
});
