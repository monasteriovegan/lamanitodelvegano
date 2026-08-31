import assert from 'node:assert/strict';
import test from 'node:test';

import {
  inspectWhatsAppEnvelope,
  recordWhatsAppWebhookObservation,
} from '../src/lib/messaging/webhook-observability.ts';

test('inspects counts and recipient asset without retaining content or sender identities', () => {
  const payload = {
    object: 'whatsapp_business_account',
    entry: [{
      changes: [{
        field: 'messages',
        value: {
          metadata: { phone_number_id: '1022209807648757', display_phone_number: '+56900000000' },
          contacts: [{ wa_id: '56911111111', profile: { name: 'Private Person' } }],
          messages: [{ id: 'wamid.secret', from: '56911111111', text: { body: 'private message body' } }],
          statuses: [{ id: 'wamid.status', recipient_id: '56911111111', status: 'delivered' }],
          message_echoes: [{ id: 'wamid.echo', to: '56911111111', text: { body: 'private echo' } }],
        },
      }],
    }],
  };

  const result = inspectWhatsAppEnvelope(payload);

  assert.deepEqual(result, {
    objectType: 'whatsapp_business_account',
    fields: ['messages'],
    messageCount: 1,
    statusCount: 1,
    echoCount: 1,
    observedPhoneNumberId: '1022209807648757',
  });
  const serialized = JSON.stringify(result);
  for (const secret of ['private message body', 'private echo', 'Private Person', '56911111111', 'wamid.secret']) {
    assert.doesNotMatch(serialized, new RegExp(secret));
  }
});

test('malformed envelopes produce zero safe counts', () => {
  assert.deepEqual(inspectWhatsAppEnvelope(null), {
    objectType: null,
    fields: [],
    messageCount: 0,
    statusCount: 0,
    echoCount: 0,
    observedPhoneNumberId: null,
  });
});

test('durable observation merges existing metadata and writes only enumerated safe fields', async () => {
  let upserted: Record<string, unknown> | null = null;
  const db = {
    from(table: string) {
      assert.equal(table, 'messaging_transport_status');
      return {
        select(columns: string) {
          assert.equal(columns, 'metadata');
          return {
            eq(column: string, value: string) {
              assert.equal(column, 'transport');
              assert.equal(value, 'cloud_api');
              return {
                async maybeSingle() {
                  return { data: { metadata: { retained: 'yes', webhook: { previous: true } } }, error: null };
                },
              };
            },
          };
        },
        async upsert(value: Record<string, unknown>) {
          upserted = value;
          return { error: null };
        },
      };
    },
  };

  await recordWhatsAppWebhookObservation(db as never, {
    outcome: 'persisted',
    requestId: 'request-safe-1',
    observedPhoneNumberId: '1022209807648757',
    configuredPhoneNumberId: '1022209807648757',
    counts: { messages: 1, statuses: 0, echoes: 0 },
    errorCode: null,
  });

  assert.ok(upserted);
  const metadata = upserted.metadata as Record<string, any>;
  assert.equal(metadata.retained, 'yes');
  assert.equal(metadata.webhook.previous, true);
  assert.equal(metadata.webhook.last_outcome, 'persisted');
  assert.equal(metadata.webhook.request_id, 'request-safe-1');
  assert.equal(metadata.webhook.message_count, 1);
  assert.equal(metadata.webhook.phone_number_match, true);
  assert.match(metadata.webhook.last_received_at, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(upserted.transport, 'cloud_api');
  assert.doesNotMatch(JSON.stringify(upserted), /body|sender|contact|token/i);
});

test('observer records mismatch and safe error codes without arbitrary error text', async () => {
  let upserted: Record<string, any> | null = null;
  const db = {
    from() {
      return {
        select() {
          return { eq() { return { async maybeSingle() { return { data: null, error: null }; } }; } };
        },
        async upsert(value: Record<string, any>) {
          upserted = value;
          return { error: null };
        },
      };
    },
  };

  await recordWhatsAppWebhookObservation(db as never, {
    outcome: 'phone_number_mismatch',
    requestId: 'request-safe-2',
    observedPhoneNumberId: 'other-id',
    configuredPhoneNumberId: 'expected-id',
    errorCode: 'phone_number_mismatch',
  });

  assert.equal(upserted!.metadata.webhook.phone_number_match, false);
  assert.equal(upserted!.metadata.webhook.error_code, 'phone_number_mismatch');
});
