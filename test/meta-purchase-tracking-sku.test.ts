import test from 'node:test';
import assert from 'node:assert/strict';
import { sendPaidPurchaseToMeta } from '../src/lib/meta/conversions-api.ts';

test('Meta Purchase Tracking uses canonical Catalog SKU as content_ids instead of UUID', async () => {
  const capturedRequests: any[] = [];
  const originalFetch = globalThis.fetch;
  process.env.META_CONVERSIONS_API_ACCESS_TOKEN = 'test_token_secret_xyz';

  globalThis.fetch = (async (url: string, init: any) => {
    capturedRequests.push({ url, body: JSON.parse(init.body) });
    return new Response(JSON.stringify({
      events_received: 1,
      messages: [],
      fbtrace_id: 'EVID_TRACE_TEST_123',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as any;

  try {
    const mockOrder = {
      id: 13,
      business_unit_id: 'bu-la-manito',
      customer_id: 'cust-1',
      total: 2900,
      currency: 'CLP',
      payment_status: 'paid',
      customer_email: 'test@example.com',
      telefono: '+56912345678',
      items: [
        {
          productoId: '170f0000-0000-0000-0000-00000000f6df',
          sku: 'FP26-EMP-UNIT',
          nombre: 'La Empanada del 18',
          precio: 2900,
          qty: 1,
        },
      ],
    };

    let updatedConversionEvent: any = null;

    const mockDb: any = {
      from: (table: string) => {
        if (table === 'integraciones_secretas') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { meta_pixel_id: '1982469039131019' } }),
              }),
            }),
          };
        }
        if (table === 'pedidos') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: mockOrder }),
                }),
              }),
            }),
          };
        }
        if (table === 'conversion_events') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: null, error: null }),
                  order: () => ({
                    limit: () => ({
                      maybeSingle: async () => ({ data: null, error: null }),
                    }),
                  }),
                }),
              }),
            }),
            insert: async (row: any) => {
              return { error: null };
            },
            update: (payload: any) => ({
              eq: () => ({
                eq: async () => {
                  updatedConversionEvent = payload;
                  return { error: null };
                },
              }),
            }),
          };
        }
        return {};
      },
    };

    const result = await sendPaidPurchaseToMeta(mockDb, 13);
    assert.equal(result.sent, true);
    assert.equal(result.eventId, 'purchase_13');

    assert.equal(capturedRequests.length, 1);
    const eventPayload = capturedRequests[0].body.data[0];

    // Verify content_ids contains the canonical SKU FP26-EMP-UNIT, NOT the UUID
    assert.deepEqual(eventPayload.custom_data.content_ids, ['FP26-EMP-UNIT']);
    assert.notEqual(eventPayload.custom_data.content_ids[0], '170f0000-0000-0000-0000-00000000f6df');
    assert.equal(eventPayload.event_id, 'purchase_13');

    // Verify Meta API response persistence
    assert.ok(updatedConversionEvent);
    assert.equal(updatedConversionEvent.status, 'sent');
    assert.equal(updatedConversionEvent.provider_results.meta_capi.http_status, 200);
    assert.equal(updatedConversionEvent.provider_results.meta_capi.accepted, true);
    assert.equal(updatedConversionEvent.provider_results.meta_capi.events_received, 1);
    assert.equal(updatedConversionEvent.provider_results.meta_capi.fbtrace_id, 'EVID_TRACE_TEST_123');
    assert.equal(updatedConversionEvent.provider_results.meta_capi.order_id, 13);
    assert.equal(updatedConversionEvent.provider_results.meta_capi.event_id, 'purchase_13');
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.META_CONVERSIONS_API_ACCESS_TOKEN;
  }
});

test('sendPaidPurchaseToMeta resolves canonical SKU from DB if missing in stored order item JSON', async () => {
  const capturedRequests: any[] = [];
  const originalFetch = globalThis.fetch;
  process.env.META_CONVERSIONS_API_ACCESS_TOKEN = 'test_token_secret_xyz';

  globalThis.fetch = (async (url: string, init: any) => {
    capturedRequests.push({ url, body: JSON.parse(init.body) });
    return new Response(JSON.stringify({ events_received: 1, fbtrace_id: 'TRACE_FALLBACK_456' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as any;

  try {
    const mockOrderLegacy = {
      id: 13,
      business_unit_id: 'bu-la-manito',
      customer_id: 'cust-1',
      total: 2900,
      currency: 'CLP',
      payment_status: 'paid',
      customer_email: 'test@example.com',
      telefono: '+56912345678',
      items: [
        {
          productoId: '170f0000-0000-0000-0000-00000000f6df',
          nombre: 'La Empanada del 18',
          precio: 2900,
          qty: 1,
        },
      ],
    };

    const mockDb: any = {
      from: (table: string) => {
        if (table === 'integraciones_secretas') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { meta_pixel_id: '1982469039131019' } }),
              }),
            }),
          };
        }
        if (table === 'pedidos') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: mockOrderLegacy }),
                }),
              }),
            }),
          };
        }
        if (table === 'productos') {
          return {
            select: () => ({
              in: async () => ({
                data: [{ id: '170f0000-0000-0000-0000-00000000f6df', sku: 'FP26-EMP-UNIT' }],
              }),
            }),
          };
        }
        if (table === 'product_variants') {
          return {
            select: () => ({
              in: async () => ({ data: [] }),
            }),
          };
        }
        if (table === 'conversion_events') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: null, error: null }),
                  order: () => ({
                    limit: () => ({
                      maybeSingle: async () => ({ data: null, error: null }),
                    }),
                  }),
                }),
              }),
            }),
            insert: async () => ({ error: null }),
            update: () => ({
              eq: () => ({
                eq: async () => ({ error: null }),
              }),
            }),
          };
        }
        return {};
      },
    };

    const result = await sendPaidPurchaseToMeta(mockDb, 13);
    assert.equal(result.sent, true);
    assert.equal(capturedRequests.length, 1);
    const eventPayload = capturedRequests[0].body.data[0];

    // Fallback query must successfully resolve to canonical SKU
    assert.deepEqual(eventPayload.custom_data.content_ids, ['FP26-EMP-UNIT']);
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.META_CONVERSIONS_API_ACCESS_TOKEN;
  }
});

test('sendPaidPurchaseToMeta is idempotent and returns duplicate: true when already sent', async () => {
  let fetchCalled = false;
  const originalFetch = globalThis.fetch;
  process.env.META_CONVERSIONS_API_ACCESS_TOKEN = 'test_token_secret_xyz';

  globalThis.fetch = (async () => {
    fetchCalled = true;
    return new Response('{}', { status: 200 });
  }) as any;

  try {
    const mockOrder = {
      id: 13,
      business_unit_id: 'bu-la-manito',
      customer_id: 'cust-1',
      total: 2900,
      currency: 'CLP',
      payment_status: 'paid',
      customer_email: 'test@example.com',
      telefono: '+56912345678',
      items: [{ productoId: '170f0000-0000-0000-0000-00000000f6df', sku: 'FP26-EMP-UNIT', qty: 1 }],
    };

    const mockDb: any = {
      from: (table: string) => {
        if (table === 'integraciones_secretas') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { meta_pixel_id: '1982469039131019' } }),
              }),
            }),
          };
        }
        if (table === 'pedidos') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: mockOrder }),
                }),
              }),
            }),
          };
        }
        if (table === 'conversion_events') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  // Simulating already sent event
                  maybeSingle: async () => ({ data: { id: 'evt-existing', status: 'sent' }, error: null }),
                }),
              }),
            }),
          };
        }
        return {};
      },
    };

    const result = await sendPaidPurchaseToMeta(mockDb, 13);
    assert.equal(result.sent, true);
    assert.equal(result.eventId, 'purchase_13');
    assert.equal((result as any).duplicate, true);
    assert.equal(fetchCalled, false, 'Fetch must not be called when already sent');
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.META_CONVERSIONS_API_ACCESS_TOKEN;
  }
});
