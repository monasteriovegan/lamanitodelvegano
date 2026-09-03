import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import {
  hasCustomerPickupSignal,
  shouldAttemptWhatsappAutoSale,
} from '../src/lib/orders/whatsapp-auto-sale-signals.ts';

function inbound(text: string | null, message_type = 'text') {
  return {
    channel: 'whatsapp',
    direction: 'inbound',
    message_type,
    text,
  } as any;
}

test('retries WhatsApp auto-sale when customer switches to pickup', () => {
  assert.equal(shouldAttemptWhatsappAutoSale(inbound('lo iré a buscar al metro La Moneda')), true);
  assert.equal(hasCustomerPickupSignal([
    { id: '1', direction: 'inbound', body: 'lo iré a buscar al metro La Moneda', payload: null },
  ]), true);
});

test('retries WhatsApp auto-sale when customer supplies their name after payment intent', () => {
  assert.equal(shouldAttemptWhatsappAutoSale(inbound('Mi nombre es Josefa Moreno')), true);
});

test('retries WhatsApp auto-sale on receipt-like media so a pending sale can advance', () => {
  assert.equal(shouldAttemptWhatsappAutoSale(inbound(null, 'image')), true);
  assert.equal(shouldAttemptWhatsappAutoSale(inbound(null, 'document')), true);
  assert.equal(shouldAttemptWhatsappAutoSale(inbound(null, 'sticker')), false);
});

test('WhatsApp auto-sale has an explicit pickup path that does not require checkout shipping fields', () => {
  const source = readFileSync(new URL('../src/lib/orders/whatsapp-auto-sale.ts', import.meta.url), 'utf8');
  assert.match(source, /hasCustomerPickupSignal/);
  assert.match(source, /confirmWhatsappPickupSale/);
  assert.match(source, /shippingZoneName:\s*['"]Retiro acordado por conversación['"]/);
});

test('WhatsApp Business App echoes are eligible for payment reconciliation without invoking Remy', () => {
  const source = readFileSync(new URL('../src/lib/messaging/whatsapp-webhook-handlers.ts', import.meta.url), 'utf8');
  assert.match(source, /isAppEcho[\s\S]*attemptAutoSale/);
});

test('WABA subscription explicitly requests SMB message echoes alongside messages', () => {
  const source = readFileSync(new URL('../src/lib/meta/waba-subscription.ts', import.meta.url), 'utf8');
  assert.match(source, /messages,smb_message_echoes/);
});

test('conversation polling refreshes messages in background without re-entering loading state', () => {
  const source = readFileSync(new URL('../src/app/admin/conversaciones/ConversationsClient.tsx', import.meta.url), 'utf8');
  assert.match(source, /loadMessages\(selectedId,\s*true\)/);
  assert.match(source, /background[^\n]*boolean/);
});
