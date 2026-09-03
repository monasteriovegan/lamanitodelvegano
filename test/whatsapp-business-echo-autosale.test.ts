import assert from 'node:assert/strict';
import test from 'node:test';

import { createWhatsAppWebhookHandlers } from '../src/lib/messaging/whatsapp-webhook-handlers.ts';

const inspection = {
  objectType: 'whatsapp_business_account',
  fields: ['smb_message_echoes'],
  messageCount: 0,
  statusCount: 0,
  echoCount: 1,
  observedPhoneNumberId: 'phone-1',
};

test('WhatsApp Business app echo reconciles auto-sale and never invokes Remy', async () => {
  let autoReplyCalls = 0;
  let autoSaleCalls = 0;
  let persistCalls = 0;

  const handlers = createWhatsAppWebhookHandlers({
    createDb: () => ({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { wa_verify_token: 'verify' } }),
          }),
        }),
      }),
    }),
    verify: () => true,
    normalize: () => [{
      direction: 'outbound',
      message_type: 'text',
      text: 'Pago recibido, gracias',
      raw_payload: { source: 'whatsapp_business_app' },
    } as any],
    inspect: () => inspection,
    observe: async () => undefined,
    persist: async () => {
      persistCalls += 1;
      return { duplicate: false, conversationId: 'conversation-1', customerId: 'customer-1', messageId: 'message-1' };
    },
    autoReply: async () => {
      autoReplyCalls += 1;
      return { called: true, replied: true };
    },
    autoSale: async () => {
      autoSaleCalls += 1;
    },
    sendMode: () => 'live',
    configuredPhoneNumberId: 'phone-1',
  });

  const response = await handlers.POST(new Request('https://example.com/api/whatsapp', {
    method: 'POST',
    headers: { 'x-hub-signature-256': 'sha256=test' },
    body: JSON.stringify({ object: 'whatsapp_business_account' }),
  }));
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.app_echoes, 1);
  assert.equal(persistCalls, 1);
  assert.equal(autoSaleCalls, 1);
  assert.equal(autoReplyCalls, 0);
});
