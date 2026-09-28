import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sendPaidPurchaseToMeta } from '../src/lib/meta/conversions-api.ts';

type RecordedRequest = {
  url: string;
  body: {
    data: Array<{
      event_name: string;
      event_id: string;
      custom_data: Record<string, unknown>;
    }>;
  };
};

type RecordedWrite = {
  kind: 'insert' | 'update';
  payload: Record<string, unknown>;
};

test('Remy global OFF does not disable a paid web Purchase through Meta CAPI', async () => {
  const originalFetch = globalThis.fetch;
  const previous = {
    token: process.env.META_CONVERSIONS_API_ACCESS_TOKEN,
    capiEnabled: process.env.META_CAPI_ENABLED,
    vercelEnv: process.env.VERCEL_ENV,
    previewSafe: process.env.LMV_PREVIEW_SAFE_MODE,
    cutoverFreeze: process.env.LMV_CUTOVER_FREEZE,
  };
  const requests: RecordedRequest[] = [];
  const writes: RecordedWrite[] = [];

  process.env.META_CONVERSIONS_API_ACCESS_TOKEN = 'meta-test-token';
  process.env.META_CAPI_ENABLED = 'false';
  process.env.VERCEL_ENV = 'production';
  delete process.env.LMV_PREVIEW_SAFE_MODE;
  delete process.env.LMV_CUTOVER_FREEZE;

  globalThis.fetch = (async (url: string, init: RequestInit) => {
    requests.push({ url, body: JSON.parse(String(init.body)) });
    return new Response(JSON.stringify({ events_received: 1, fbtrace_id: 'trace-remy-independent' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  const order = {
    id: 901,
    business_unit_id: 'business-1',
    customer_id: 'customer-1',
    total: 12990,
    currency: 'CLP',
    items: [{ sku: 'SKU-VEGAN-1', qty: 1 }],
    customer_email: 'buyer@example.invalid',
    telefono: '+56900000000',
    payment_status: 'paid',
    source_channel: 'web',
  };

  const db = {
    from(table: string) {
      if (table === 'integraciones_secretas') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { meta_pixel_id: 'pixel-1', ai_enabled: false },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'pedidos') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({ maybeSingle: async () => ({ data: order, error: null }) }),
            }),
          }),
        };
      }
      if (table === 'conversion_events') {
        return {
          select(columns: string) {
            if (columns === 'id,status') {
              return { eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) };
            }
            return {
              eq: () => ({
                eq: () => ({
                  order: () => ({
                    limit: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
                  }),
                }),
              }),
            };
          },
          insert: async (payload: Record<string, unknown>) => {
            writes.push({ kind: 'insert', payload });
            return { error: null };
          },
          update: (payload: Record<string, unknown>) => ({
            eq: () => ({
              eq: async () => {
                writes.push({ kind: 'update', payload });
                return { error: null };
              },
            }),
          }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    },
  } as unknown as SupabaseClient;

  try {
    const result = await sendPaidPurchaseToMeta(db, order.id);

    assert.deepEqual(result, { sent: true, eventId: 'purchase_901' });
    assert.equal(requests.length, 1);
    const event = requests[0].body.data[0];
    assert.equal(event.event_name, 'Purchase');
    assert.equal(event.event_id, 'purchase_901');
    assert.equal(event.custom_data.order_id, '901');
    assert.equal(event.custom_data.value, 12990);
    assert.equal(event.custom_data.currency, 'CLP');
    assert.ok(writes.some((write) => write.kind === 'update' && write.payload.status === 'sent'));
  } finally {
    globalThis.fetch = originalFetch;
    if (previous.token === undefined) delete process.env.META_CONVERSIONS_API_ACCESS_TOKEN;
    else process.env.META_CONVERSIONS_API_ACCESS_TOKEN = previous.token;
    if (previous.capiEnabled === undefined) delete process.env.META_CAPI_ENABLED;
    else process.env.META_CAPI_ENABLED = previous.capiEnabled;
    if (previous.vercelEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = previous.vercelEnv;
    if (previous.previewSafe === undefined) delete process.env.LMV_PREVIEW_SAFE_MODE;
    else process.env.LMV_PREVIEW_SAFE_MODE = previous.previewSafe;
    if (previous.cutoverFreeze === undefined) delete process.env.LMV_CUTOVER_FREEZE;
    else process.env.LMV_CUTOVER_FREEZE = previous.cutoverFreeze;
  }
});
