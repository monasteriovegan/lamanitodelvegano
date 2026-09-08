import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { sendPaidPurchaseToMeta } from '../src/lib/meta/conversions-api.ts';

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

function nonWebPaidDb(sourceChannel: string) {
  let conversionTouched = false;
  const db: any = {
    from(table: string) {
      if (table === 'integraciones_secretas') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { meta_pixel_id: '1982469039131019' } }) }) }),
        };
      }
      if (table === 'pedidos') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: {
                    id: 19,
                    business_unit_id: 'bu-la-manito',
                    customer_id: 'customer-19',
                    source_channel: sourceChannel,
                    total: 27800,
                    currency: 'CLP',
                    payment_status: 'paid',
                    items: [{ sku: 'FP26-EMP-PACK10', qty: 1 }],
                  },
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'conversion_events') {
        conversionTouched = true;
        return {};
      }
      return {};
    },
  };
  return { db, wasConversionTouched: () => conversionTouched };
}

for (const sourceChannel of ['instagram', 'whatsapp', 'manual', 'admin']) {
  test(`paid ${sourceChannel} order does not emit Website Purchase CAPI`, async () => {
    const { db, wasConversionTouched } = nonWebPaidDb(sourceChannel);
    const originalFetch = globalThis.fetch;
    let fetchCalled = false;
    process.env.META_CONVERSIONS_API_ACCESS_TOKEN = 'test_token';
    globalThis.fetch = (async () => {
      fetchCalled = true;
      return new Response('{}', { status: 200 });
    }) as any;

    try {
      const result = await sendPaidPurchaseToMeta(db, 19);
      assert.deepEqual(result, { sent: false, reason: 'non_web_order' });
      assert.equal(fetchCalled, false);
      assert.equal(wasConversionTouched(), false, 'non-web order must not create/update Website conversion_events');
    } finally {
      globalThis.fetch = originalFetch;
      delete process.env.META_CONVERSIONS_API_ACCESS_TOKEN;
    }
  });
}

test('public paid-order page only renders Browser Purchase tracking for web source', () => {
  const page = read('src/app/pedido/[id]/page.tsx');
  assert.match(page, /source_channel/);
  assert.match(page, /source_channel[^\n]*web|web[^\n]*source_channel/i);
  assert.match(page, /PurchaseTracking/);
  assert.match(page, /esExito\s*&&\s*isWebPurchase|isWebPurchase\s*&&\s*esExito/);
});
