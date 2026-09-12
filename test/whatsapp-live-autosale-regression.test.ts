import assert from 'node:assert/strict';
import test from 'node:test';

import { createWhatsAppWebhookHandlers } from '../src/lib/messaging/whatsapp-webhook-handlers.ts';

test('live WhatsApp still reconciles an eligible sale after Remy replied', async () => {
  let autoReplyCalls = 0;
  let autoSaleCalls = 0;

  const handlers = createWhatsAppWebhookHandlers({
    createDb: () => ({}) as never,
    verify: () => true,
    normalize: () => [{ direction: 'inbound', message_type: 'text', raw_payload: {} }],
    inspect: () => ({
      objectType: 'whatsapp_business_account',
      fields: ['messages'],
      messageCount: 1,
      statusCount: 0,
      echoCount: 0,
      observedPhoneNumberId: 'phone-id',
    }),
    observe: async () => undefined,
    persist: async () => ({
      duplicate: false,
      conversationId: 'conversation-id',
      customerId: 'customer-id',
      messageId: 'message-id',
    }),
    autoReply: async () => {
      autoReplyCalls += 1;
      return { called: true, replied: true };
    },
    autoSale: async () => {
      autoSaleCalls += 1;
    },
    appSecret: 'secret',
    configuredPhoneNumberId: 'phone-id',
    sendMode: () => 'live',
    logError: () => undefined,
  });

  const response = await handlers.POST(new Request('https://example.test/api/whatsapp', {
    method: 'POST',
    headers: { 'x-hub-signature-256': 'valid' },
    body: JSON.stringify({ object: 'whatsapp_business_account' }),
  }));

  assert.equal(response.status, 200);
  assert.equal(autoReplyCalls, 1);
  assert.equal(autoSaleCalls, 1, 'sale reconciliation must run even when Remy replied');
});
