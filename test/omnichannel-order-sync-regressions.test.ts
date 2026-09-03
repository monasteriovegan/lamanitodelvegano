import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  hasReceiptBackedBusinessConfirmation,
  type InstagramPaymentMessage,
} from '../src/lib/orders/instagram-auto-sale-signals.ts';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

test('Instagram acepta confirmación humana corta después de comprobante y contexto de transferencia', () => {
  const messages: InstagramPaymentMessage[] = [
    { direction: 'inbound', body: 'Dígame el total y datos para transferir', message_type: 'text', payload: {} },
    { direction: 'outbound', body: 'Estos son los datos para transferencia', message_type: 'text', payload: { sender_type: 'human' } },
    { direction: 'inbound', body: null, message_type: 'image', payload: {} },
    { direction: 'outbound', body: 'Super amiga confirmado', message_type: 'text', payload: { sender_type: 'human' } },
  ];
  assert.equal(hasReceiptBackedBusinessConfirmation(messages), true);
});

test('una confirmación genérica sin comprobante no se considera pago', () => {
  const messages: InstagramPaymentMessage[] = [
    { direction: 'outbound', body: 'Super amiga confirmado', message_type: 'text', payload: { sender_type: 'human' } },
  ];
  assert.equal(hasReceiptBackedBusinessConfirmation(messages), false);
});

test('el extractor de venta permite producto personalizado y despacho explícito del chat', () => {
  const source = read('src/lib/orders/conversation-sale.ts');
  assert.match(source, /customUnitPrice/);
  assert.match(source, /explicitShippingCost/);
  assert.match(source, /isCustom/);
  assert.match(source, /stockItems/);
});

test('el RPC canónico permite items personalizados sin inventar producto de catálogo', () => {
  const migration = read('supabase/migrations/20260903183000_conversation_order_custom_items.sql');
  assert.match(migration, /empty_conversation_order_items/);
  assert.match(migration, /jsonb_array_elements\(p_order_items\)/);
  assert.match(migration, /custom/);
  assert.doesNotMatch(migration, /jsonb_array_length\(p_stock_items\)\s*=\s*0\s+then\s+raise exception 'empty_conversation_order_items'/i);
});

test('Pedidos muestra el canal de venta a primera vista en desktop y móvil', () => {
  const page = read('src/app/admin/pedidos/page.tsx');
  assert.match(page, /Canal/);
  assert.match(page, /CHANNEL_LABELS/);
  assert.match(page, /o\.source/);
});
