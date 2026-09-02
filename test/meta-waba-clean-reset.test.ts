import assert from 'node:assert/strict';
import test from 'node:test';

import {
  readWabaSubscriptionWithHeaders,
  runCleanWabaSubscriptionReset,
  subscribeWabaOnce,
} from '../src/lib/meta/waba-clean-reset.ts';

const WABA_ID = '1129249369256097';
const APP_ID = '1691394752113175';
const TOKEN = 'system-user-secret';
const CALLBACK = 'https://lamanitodelvegano.cl/api/meta/webhooks/whatsapp';

function graph(body: unknown, version: string, requestId: string) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'facebook-api-version': version,
      'x-fb-request-id': requestId,
      'x-fb-trace-id': `trace-${requestId}`,
    },
  });
}

test('v26 clean reset captures Meta correlation headers and configures callback only after read-back', async () => {
  const calls: Array<{ url: string; method: string; body: string | null }> = [];
  const responses = [
    graph({ success: true }, 'v26.0', 'delete-26'),
    graph({ data: [] }, 'v26.0', 'get-empty-26'),
    graph({ success: true }, 'v26.0', 'post-clean-26'),
    graph({ data: [{ whatsapp_business_api_data: { id: APP_ID } }] }, 'v26.0', 'get-app-26'),
    graph({ success: true }, 'v26.0', 'post-callback-26'),
    graph({ data: [{ whatsapp_business_api_data: { id: APP_ID } }] }, 'v26.0', 'get-callback-26'),
  ];
  const result = await runCleanWabaSubscriptionReset({
    wabaId: WABA_ID,
    appId: APP_ID,
    token: TOKEN,
    verifyToken: 'verify-secret',
    canonicalCallbackUri: CALLBACK,
    fetchImpl: async (input, init) => {
      calls.push({ url: String(input), method: init?.method || 'GET', body: init?.body ? String(init.body) : null });
      return responses.shift()!;
    },
  });

  assert.deepEqual(calls.map(({ method }) => method), ['DELETE', 'GET', 'POST', 'GET', 'POST', 'GET']);
  assert.equal(calls[2]?.body, null);
  assert.equal(calls[4]?.body, `override_callback_uri=${encodeURIComponent(CALLBACK)}&verify_token=verify-secret`);
  assert.equal(result.status, 'subscribed');
  assert.equal(result.successfulVersion, 'v26.0');
  assert.equal(result.calls[0]?.headers.requestId, 'delete-26');
  assert.equal(result.calls[0]?.headers.traceId, 'trace-delete-26');
  assert.equal(result.calls[0]?.headers.facebookApiVersion, 'v26.0');
  assert.deepEqual(result.calls[3]?.appIds, [APP_ID]);
  assert.equal(JSON.stringify(result).includes(TOKEN), false);
  assert.equal(JSON.stringify(result).includes('verify-secret'), false);
});

test('an empty v26 read-back performs exactly one v24 subscribe attempt', async () => {
  const calls: Array<{ url: string; method: string; body: string | null }> = [];
  const responses = [
    graph({ success: true }, 'v26.0', 'delete-26'),
    graph({ data: [] }, 'v26.0', 'get-empty-after-delete'),
    graph({ success: true }, 'v26.0', 'post-26'),
    graph({ data: [] }, 'v26.0', 'get-empty-after-post'),
    graph({ success: true }, 'v24.0', 'post-24'),
    graph({ data: [] }, 'v24.0', 'get-empty-24'),
  ];
  const result = await runCleanWabaSubscriptionReset({
    wabaId: WABA_ID,
    appId: APP_ID,
    token: TOKEN,
    verifyToken: 'verify-secret',
    canonicalCallbackUri: CALLBACK,
    fetchImpl: async (input, init) => {
      calls.push({ url: String(input), method: init?.method || 'GET', body: init?.body ? String(init.body) : null });
      return responses.shift()!;
    },
  });

  assert.deepEqual(calls.map(({ method }) => method), ['DELETE', 'GET', 'POST', 'GET', 'POST', 'GET']);
  assert.match(calls[4]!.url, /\/v24\.0\//);
  assert.equal(calls[4]?.body, null);
  assert.equal(result.status, 'not_subscribed');
  assert.equal(result.successfulVersion, null);
  assert.equal(result.calls.filter((call) => call.version === 'v24.0' && call.method === 'POST').length, 1);
});

test('read-only read-back returns app ids and Meta correlation headers', async () => {
  const result = await readWabaSubscriptionWithHeaders({
    version: 'v26.0',
    wabaId: WABA_ID,
    token: TOKEN,
    fetchImpl: async () => graph(
      { data: [{ whatsapp_business_api_data: { id: APP_ID } }] },
      'v26.0',
      'readback-26',
    ),
  });
  assert.equal(result.method, 'GET');
  assert.deepEqual(result.appIds, [APP_ID]);
  assert.deepEqual(result.headers, {
    facebookApiVersion: 'v26.0',
    requestId: 'readback-26',
    traceId: 'trace-readback-26',
  });
  assert.equal(JSON.stringify(result).includes(TOKEN), false);
});

test('single subscribe keeps other apps and succeeds only when GET contains the target app', async () => {
  const methods: string[] = [];
  const responses = [
    graph({ success: true }, 'v26.0', 'single-post'),
    graph({ data: [
      { whatsapp_business_api_data: { id: '1143680903703001' } },
      { whatsapp_business_api_data: { id: APP_ID } },
    ] }, 'v26.0', 'single-get'),
  ];
  const result = await subscribeWabaOnce({
    version: 'v26.0', wabaId: WABA_ID, appId: APP_ID, token: TOKEN,
    fetchImpl: async (_input, init) => {
      methods.push(init?.method || 'GET');
      return responses.shift()!;
    },
  });
  assert.deepEqual(methods, ['POST', 'GET']);
  assert.equal(result.status, 'subscribed');
  assert.deepEqual(result.readback.appIds, ['1143680903703001', APP_ID]);
  assert.equal(result.mutation.headers.requestId, 'single-post');
  assert.equal(result.readback.headers.requestId, 'single-get');
  assert.equal(JSON.stringify(result).includes(TOKEN), false);
});
