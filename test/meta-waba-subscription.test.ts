import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ensureWabaMessagesSubscription,
  listWabaSubscriptions,
  listWabaPhoneNumbers,
  parseWabaSubscription,
} from '../src/lib/meta/waba-subscription.ts';

const APP_ID = '1691394752113175';
const WABA_ID = '1129249369256097';
const TOKEN = 'secret-token-that-must-never-be-returned';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('lists only safe phone-number asset fields from the configured WABA', async () => {
  const result = await listWabaPhoneNumbers({
    graphVersion: 'v26.0', wabaId: WABA_ID, token: TOKEN,
    fetchImpl: async () => json({ data: [{ id: 'phone-1', display_phone_number: '+5600', verified_name: 'LMV', quality_rating: 'GREEN' }] }),
  });
  assert.deepEqual(result, {
    httpStatus: 200,
    phones: [{ id: 'phone-1', displayPhoneNumber: '+5600', verifiedName: 'LMV', qualityRating: 'GREEN' }],
    error: null,
  });
});

test('lists only app ids and subscribed fields from WABA read-back', async () => {
  const fetchImpl = async () => new Response(JSON.stringify({ data: [
    { id: 'historical-app', name: 'secret name', subscribed_fields: ['messages'] },
    { id: 'main-app', subscribed_fields: ['messages', 'smb_message_echoes'] },
  ] }), { status: 200 });
  assert.deepEqual(await listWabaSubscriptions({
    graphVersion: 'v26.0', wabaId: WABA_ID, token: 'server-secret', fetchImpl,
  }), {
    httpStatus: 200,
    apps: [
      { appId: 'historical-app', fields: ['messages'] },
      { appId: 'main-app', fields: ['messages', 'smb_message_echoes'] },
    ],
    error: null,
  });
});

test('recognizes Meta current nested whatsapp_business_api_data app shape', async () => {
  const nested = {
    data: [{
      whatsapp_business_api_data: {
        id: APP_ID,
        name: 'synthetiq Core sirve',
        link: 'https://www.facebook.com/games/?app_id=1691394752113175',
      },
    }],
  };
  assert.deepEqual(await listWabaSubscriptions({
    graphVersion: 'v26.0', wabaId: WABA_ID, token: TOKEN,
    fetchImpl: async () => json(nested),
  }), {
    httpStatus: 200,
    apps: [{ appId: APP_ID, fields: [] }],
    error: null,
  });
  assert.equal(parseWabaSubscription(nested, APP_ID).status, 'subscribed');
});

test('parses the expected app with messages as subscribed', () => {
  assert.deepEqual(
    parseWabaSubscription({ data: [{ id: APP_ID, subscribed_fields: ['messages', 'smb_message_echoes'] }] }, APP_ID),
    {
      status: 'subscribed',
      appId: APP_ID,
      fields: ['messages', 'smb_message_echoes'],
      httpStatus: null,
      error: null,
    },
  );
});

test('treats an absent app or missing messages field as not subscribed', () => {
  assert.equal(parseWabaSubscription({ data: [] }, APP_ID).status, 'not_subscribed');
  assert.deepEqual(
    parseWabaSubscription({ data: [{ id: APP_ID, subscribed_fields: ['statuses'] }] }, APP_ID),
    {
      status: 'not_subscribed',
      appId: APP_ID,
      fields: ['statuses'],
      httpStatus: null,
      error: null,
    },
  );
});

test('Graph errors and malformed responses remain unknown and redact token-like values', () => {
  const graphError = parseWabaSubscription({
    error: {
      code: 190,
      type: 'OAuthException',
      message: `Invalid OAuth access token ${TOKEN}`,
    },
  }, APP_ID);

  assert.equal(graphError.status, 'unknown');
  assert.match(String(graphError.error), /190/);
  assert.doesNotMatch(String(graphError.error), new RegExp(TOKEN));
  assert.deepEqual(parseWabaSubscription({ unexpected: true }, APP_ID), {
    status: 'unknown',
    appId: APP_ID,
    fields: [],
    httpStatus: null,
    error: 'malformed_graph_response',
  });
});

test('already subscribed to messages and SMB echoes performs one GET and no mutation', async () => {
  const calls: Array<{ url: string; method: string; authorization: string | null }> = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    calls.push({
      url: String(input),
      method: init?.method || 'GET',
      authorization: new Headers(init?.headers).get('authorization'),
    });
    return json({ data: [{ id: APP_ID, subscribed_fields: ['messages', 'smb_message_echoes'] }] });
  };

  const result = await ensureWabaMessagesSubscription({
    graphVersion: 'v26.0',
    wabaId: WABA_ID,
    appId: APP_ID,
    token: TOKEN,
    fetchImpl,
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.method, 'GET');
  assert.equal(calls[0]?.authorization, `Bearer ${TOKEN}`);
  assert.equal(result.before.status, 'subscribed');
  assert.equal(result.mutationStatus, null);
  assert.equal(result.after.status, 'subscribed');
});

test('messages-only subscription is upgraded to include SMB message echoes', async () => {
  const calls: Array<{ url: string; method: string }> = [];
  const responses = [
    json({ data: [{ id: APP_ID, subscribed_fields: ['messages'] }] }),
    json({ success: true }),
    json({ data: [{ id: APP_ID, subscribed_fields: ['messages', 'smb_message_echoes'] }] }),
  ];
  const fetchImpl: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), method: init?.method || 'GET' });
    return responses.shift()!;
  };

  const result = await ensureWabaMessagesSubscription({
    graphVersion: 'v26.0', wabaId: WABA_ID, appId: APP_ID, token: TOKEN, fetchImpl,
  });

  assert.deepEqual(calls.map((call) => call.method), ['GET', 'POST', 'GET']);
  const mutationUrl = new URL(calls[1]!.url);
  assert.equal(mutationUrl.searchParams.get('subscribed_fields'), 'messages,smb_message_echoes');
  assert.equal(result.mutationAccepted, true);
  assert.deepEqual(result.after.fields, ['messages', 'smb_message_echoes']);
});

test('missing subscription performs GET POST GET and trusts only the read-back', async () => {
  const calls: Array<{ url: string; method: string; body: string | null }> = [];
  const responses = [
    json({ data: [] }),
    json({ success: true }),
    json({ data: [{ id: APP_ID, subscribed_fields: ['messages', 'smb_message_echoes'] }] }),
  ];
  const fetchImpl: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), method: init?.method || 'GET', body: init?.body ? String(init.body) : null });
    return responses.shift()!;
  };

  const result = await ensureWabaMessagesSubscription({
    graphVersion: 'v26.0',
    wabaId: WABA_ID,
    appId: APP_ID,
    token: TOKEN,
    fetchImpl,
  });

  assert.deepEqual(calls.map((call) => call.method), ['GET', 'POST', 'GET']);
  assert.equal(calls[1]?.body, null);
  const mutationUrl = new URL(calls[1]!.url);
  assert.equal(mutationUrl.searchParams.get('subscribed_fields'), 'messages,smb_message_echoes');
  assert.equal(result.before.status, 'not_subscribed');
  assert.equal(result.mutationStatus, 200);
  assert.equal(result.mutationAccepted, true);
  assert.equal(result.after.status, 'subscribed');
  assert.deepEqual(result.after.fields, ['messages', 'smb_message_echoes']);
});

test('POST 200 is not success when the mandatory GET read-back remains absent', async () => {
  const responses = [json({ data: [] }), json({ success: true }), json({ data: [] })];
  const result = await ensureWabaMessagesSubscription({
    graphVersion: 'v26.0',
    wabaId: WABA_ID,
    appId: APP_ID,
    token: TOKEN,
    fetchImpl: async () => responses.shift()!,
  });

  assert.equal(result.mutationStatus, 200);
  assert.equal(result.mutationAccepted, true);
  assert.equal(result.after.status, 'not_subscribed');
});

test('a failed mutation still performs the final GET and returns sanitized state', async () => {
  const methods: string[] = [];
  const responses = [
    json({ data: [] }),
    json({ error: { code: 200, type: 'OAuthException', message: `Denied ${TOKEN}` } }, 403),
    json({ error: { code: 190, type: 'OAuthException', message: `Expired ${TOKEN}` } }, 401),
  ];
  const result = await ensureWabaMessagesSubscription({
    graphVersion: 'v26.0',
    wabaId: WABA_ID,
    appId: APP_ID,
    token: TOKEN,
    fetchImpl: async (_input, init) => {
      methods.push(init?.method || 'GET');
      return responses.shift()!;
    },
  });

  assert.deepEqual(methods, ['GET', 'POST', 'GET']);
  assert.equal(result.mutationStatus, 403);
  assert.equal(result.mutationAccepted, false);
  assert.equal(result.after.httpStatus, 401);
  assert.equal(result.after.status, 'unknown');
  assert.doesNotMatch(JSON.stringify(result), new RegExp(TOKEN));
});
