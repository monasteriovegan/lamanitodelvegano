import assert from 'node:assert/strict';
import test from 'node:test';

import { createWhatsAppWebhookHandlers } from '../src/lib/messaging/whatsapp-webhook-handlers.ts';

const PHONE_ID = '1022209807648757';

function envelope(overrides: Record<string, unknown> = {}) {
  return {
    object: 'whatsapp_business_account',
    entry: [{ changes: [{ field: 'messages', value: {
      metadata: { phone_number_id: PHONE_ID },
      messages: [{ id: 'wamid.test', from: '56911111111', type: 'text', text: { body: 'hello' } }],
      ...overrides,
    } }] }],
  };
}

function request(body: string, signature = 'valid') {
  return new Request('https://example.test/api/whatsapp', {
    method: 'POST',
    headers: { 'x-hub-signature-256': signature },
    body,
  });
}

function createDb(verifyToken = 'verify-me') {
  return {
    from(table: string) {
      assert.equal(table, 'integraciones_secretas');
      return {
        select() {
          return {
            eq() {
              return {
                async maybeSingle() {
                  return { data: { wa_verify_token: verifyToken }, error: null };
                },
              };
            },
          };
        },
      };
    },
  };
}

function harness(options: {
  mode?: 'disabled' | 'read_only' | 'live';
  normalized?: any[];
  persist?: (db: any, message: any) => Promise<any>;
  autoReplyResult?: { called: boolean; replied: boolean };
  autoSale?: (db: any, result: any, message: any) => Promise<void>;
} = {}) {
  const observations: string[] = [];
  let persistCalls = 0;
  let autoReplyCalls = 0;
  let autoSaleCalls = 0;
  const normalized = options.normalized ?? [{
    direction: 'inbound',
    message_type: 'text',
    raw_payload: {},
  }];
  const handlers = createWhatsAppWebhookHandlers({
    createDb: () => createDb() as never,
    verify: (_raw, signature, secret) => signature === 'valid' && secret === 'app-secret',
    normalize: () => normalized,
    inspect: (payload) => {
      const value = (payload as any)?.entry?.[0]?.changes?.[0]?.value ?? {};
      return {
        objectType: (payload as any)?.object ?? null,
        fields: ['messages'],
        messageCount: value.messages?.length ?? 0,
        statusCount: value.statuses?.length ?? 0,
        echoCount: value.message_echoes?.length ?? 0,
        observedPhoneNumberId: value.metadata?.phone_number_id ?? null,
      };
    },
    observe: async (_db, input) => { observations.push(input.outcome); },
    persist: async (db, message) => {
      persistCalls += 1;
      return options.persist
        ? options.persist(db, message)
        : { duplicate: false, conversationId: 'conversation', customerId: null, messageId: 'message' };
    },
    autoReply: async () => {
      autoReplyCalls += 1;
      return options.autoReplyResult ?? { called: true, replied: true };
    },
    autoSale: options.autoSale
      ? async (db, result, message) => {
          autoSaleCalls += 1;
          await options.autoSale!(db, result, message);
        }
      : async () => { autoSaleCalls += 1; },
    appSecret: 'app-secret',
    verifyToken: 'verify-me',
    configuredPhoneNumberId: PHONE_ID,
    sendMode: () => options.mode ?? 'read_only',
    logError: () => undefined,
  });
  return {
    ...handlers,
    observations,
    calls: () => ({ persist: persistCalls, autoReply: autoReplyCalls, autoSale: autoSaleCalls }),
  };
}

test('GET accepts the matching verify token and rejects a different token', async () => {
  const { GET } = harness();
  const accepted = await GET(new Request(
    'https://example.test/api/whatsapp?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=challenge-123',
  ));
  assert.equal(accepted.status, 200);
  assert.equal(await accepted.text(), 'challenge-123');

  const rejected = await GET(new Request(
    'https://example.test/api/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=x',
  ));
  assert.equal(rejected.status, 403);
});

test('invalid signature is observed and rejected before parsing or persistence', async () => {
  const h = harness();
  const response = await h.POST(request('{not-json', 'invalid'));
  assert.equal(response.status, 401);
  assert.deepEqual(h.observations, ['received', 'signature_invalid']);
  assert.deepEqual(h.calls(), { persist: 0, autoReply: 0, autoSale: 0 });
});

test('invalid JSON is observed after a valid signature', async () => {
  const h = harness();
  const response = await h.POST(request('{not-json'));
  assert.equal(response.status, 400);
  assert.deepEqual(h.observations, ['received', 'invalid_json']);
  assert.deepEqual(h.calls(), { persist: 0, autoReply: 0, autoSale: 0 });
});

test('irrelevant payload is acknowledged and classified without persistence', async () => {
  const h = harness({ normalized: [] });
  const response = await h.POST(request(JSON.stringify({ object: 'whatsapp_business_account', entry: [] })));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, ignored: true, reason: 'payload_ignored' });
  assert.deepEqual(h.observations, ['received', 'payload_ignored']);
});

test('wrong Phone Number ID is acknowledged but never persisted', async () => {
  const h = harness();
  const response = await h.POST(request(JSON.stringify(envelope({ metadata: { phone_number_id: 'wrong-id' } }))));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, ignored: true, reason: 'phone_number_mismatch' });
  assert.deepEqual(h.observations, ['received', 'phone_number_mismatch']);
  assert.deepEqual(h.calls(), { persist: 0, autoReply: 0, autoSale: 0 });
});

test('read_only persists inbound exactly once and never invokes Remy', async () => {
  const h = harness({ mode: 'read_only' });
  const response = await h.POST(request(JSON.stringify(envelope())));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    stored: 1,
    duplicates: 0,
    statuses: 0,
    app_echoes: 0,
    ai_called: false,
    ai_replied: false,
  });
  assert.deepEqual(h.observations, ['received', 'persisted']);
  assert.deepEqual(h.calls(), { persist: 1, autoReply: 0, autoSale: 1 });
});

test('duplicate is acknowledged and recorded without Remy', async () => {
  const h = harness({ persist: async () => ({
    duplicate: true,
    conversationId: 'conversation',
    customerId: null,
    messageId: 'message',
  }) });
  const response = await h.POST(request(JSON.stringify(envelope())));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).duplicates, 1);
  assert.deepEqual(h.observations, ['received', 'duplicate']);
  assert.deepEqual(h.calls(), { persist: 1, autoReply: 0, autoSale: 0 });
});

test('live mode skips the batched auto-sale extractor when Remy already replied this turn', async () => {
  const h = harness({ mode: 'live', autoReplyResult: { called: true, replied: true } });
  const response = await h.POST(request(JSON.stringify(envelope())));
  assert.equal(response.status, 200);
  assert.deepEqual(h.calls(), { persist: 1, autoReply: 1, autoSale: 0 });
});

test('live mode still runs the batched auto-sale extractor when Remy did not reply this turn', async () => {
  const h = harness({ mode: 'live', autoReplyResult: { called: false, replied: false } });
  const response = await h.POST(request(JSON.stringify(envelope())));
  assert.equal(response.status, 200);
  assert.deepEqual(h.calls(), { persist: 1, autoReply: 1, autoSale: 1 });
});

test('a failing auto-sale extraction is logged but never fails the webhook response', async () => {
  const h = harness({
    mode: 'read_only',
    autoSale: async () => { throw new Error('draft extraction failed'); },
  });
  const response = await h.POST(request(JSON.stringify(envelope())));
  assert.equal(response.status, 200);
  assert.deepEqual(h.calls(), { persist: 1, autoReply: 0, autoSale: 1 });
});

test('asset-not-connected is acknowledged while database failures return 500', async () => {
  const disconnected = harness({ persist: async () => { throw new Error('meta_asset_not_connected'); } });
  const disconnectedResponse = await disconnected.POST(request(JSON.stringify(envelope())));
  assert.equal(disconnectedResponse.status, 200);
  assert.deepEqual(await disconnectedResponse.json(), { ok: true, ignored: true, reason: 'asset_not_connected' });
  assert.deepEqual(disconnected.observations, ['received', 'asset_not_connected']);

  const failed = harness({ persist: async () => { throw new Error('database unavailable'); } });
  const failedResponse = await failed.POST(request(JSON.stringify(envelope())));
  assert.equal(failedResponse.status, 500);
  assert.deepEqual(await failedResponse.json(), { error: 'persist_failed' });
  assert.deepEqual(failed.observations, ['received', 'persistence_failed']);
});

test('live mode may invoke Remy only after successful inbound persistence', async () => {
  const h = harness({ mode: 'live' });
  const response = await h.POST(request(JSON.stringify(envelope())));
  assert.equal(response.status, 200);
  assert.deepEqual(h.calls(), { persist: 1, autoReply: 1, autoSale: 0 });
  assert.equal((await response.json()).ai_replied, true);
});
