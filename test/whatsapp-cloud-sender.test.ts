import assert from 'node:assert/strict';
import test from 'node:test';

import {
  evaluateMessagingCapability,
  type MetaSendMode,
} from '../src/lib/messaging/capability-policy.ts';
import { createWhatsAppCloudSender } from '../src/lib/messaging/whatsapp-cloud-sender.ts';

function sender(mode: MetaSendMode) {
  let fetchCalls = 0;
  let credentialCalls = 0;
  let healthWrites = 0;
  const send = createWhatsAppCloudSender({
    resolveSendMode: () => mode,
    evaluateCapability: evaluateMessagingCapability,
    getCredential: async () => {
      credentialCalls += 1;
      return { externalId: 'test-phone-id', accessToken: 'test-access-token' };
    },
    normalizePhone: (value) => value.replace(/\D/g, ''),
    fetchImpl: async (_url, init) => {
      fetchCalls += 1;
      assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer test-access-token');
      return new Response(JSON.stringify({ messages: [{ id: 'wamid.sent' }] }), { status: 200 });
    },
    writeHealth: async () => { healthWrites += 1; },
    graphVersion: 'v26.0',
  });
  return { send, calls: () => ({ fetchCalls, credentialCalls, healthWrites }) };
}

test('read_only blocks manual and automatic sends before credentials or Graph', async () => {
  for (const origin of [{ manual: true }, { automatic: true }]) {
    const h = sender('read_only');
    await assert.rejects(
      h.send({ to: '56911111111', text: 'hello' }, { ...origin, businessUnitId: 'tenant' }),
      /send_mode_read_only/,
    );
    assert.deepEqual(h.calls(), { fetchCalls: 0, credentialCalls: 0, healthWrites: 0 });
  }
});

test('disabled blocks manual and automatic sends before credentials or Graph', async () => {
  for (const origin of [{ manual: true }, { automatic: true }]) {
    const h = sender('disabled');
    await assert.rejects(
      h.send({ to: '56911111111', text: 'hello' }, { ...origin, businessUnitId: 'tenant' }),
      /send_mode_disabled/,
    );
    assert.deepEqual(h.calls(), { fetchCalls: 0, credentialCalls: 0, healthWrites: 0 });
  }
});

test('live mode sends once and updates transport health', async () => {
  const h = sender('live');
  const result = await h.send(
    { to: '56911111111', text: 'hello' },
    { automatic: true, businessUnitId: 'tenant' },
  );
  assert.equal(result.providerMessageId, 'wamid.sent');
  assert.deepEqual(h.calls(), { fetchCalls: 1, credentialCalls: 1, healthWrites: 1 });
});
