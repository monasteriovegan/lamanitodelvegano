import assert from 'node:assert/strict';
import test from 'node:test';

async function loadDeliveryDateModule() {
  return import('../src/lib/orders/delivery-date.ts');
}

function fakeDb(row: { date: string; reason: string | null } | null) {
  const filters: Array<[string, unknown]> = [];
  const query: any = {
    select() { return query; },
    eq(column: string, value: unknown) {
      filters.push([column, value]);
      return query;
    },
    async maybeSingle() {
      return { data: row, error: null };
    },
  };
  return {
    filters,
    db: {
      from(table: string) {
        assert.equal(table, 'blocked_delivery_dates');
        return query;
      },
    },
  };
}

test('blocked delivery dates are read from the authoritative business-unit table', async () => {
  const mod = await loadDeliveryDateModule();
  assert.equal(typeof mod.getDeliveryDateBlock, 'function');

  const { db, filters } = fakeDb({ date: '2026-09-12', reason: 'Fecha cerrada por administración' });
  const result = await mod.getDeliveryDateBlock(db as never, 'business-unit', '2026-09-12');

  assert.deepEqual(result, { blocked: true, reason: 'Fecha cerrada por administración' });
  assert.deepEqual(filters, [
    ['business_unit_id', 'business-unit'],
    ['date', '2026-09-12'],
  ]);
});

test('an unblocked date remains available', async () => {
  const mod = await loadDeliveryDateModule();
  const { db } = fakeDb(null);
  assert.deepEqual(
    await mod.getDeliveryDateBlock(db as never, 'business-unit', '2026-09-16'),
    { blocked: false, reason: null },
  );
});
