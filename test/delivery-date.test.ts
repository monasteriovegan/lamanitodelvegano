import assert from 'node:assert/strict';
import test from 'node:test';

async function loadDeliveryDateModule() {
  try {
    return await import('../src/lib/orders/delivery-date.ts');
  } catch (error) {
    assert.fail(`delivery-date utility missing or unloadable: ${error instanceof Error ? error.message : String(error)}`);
  }
}

test('calendar delivery dates keep 2026-09-15 as Tuesday 15 September without UTC shifting', async () => {
  const mod = await loadDeliveryDateModule();
  assert.equal(mod.normalizeDeliveryDate('2026-09-15'), '2026-09-15');
  assert.equal(mod.formatDeliveryDateLong('2026-09-15'), 'Martes 15 de septiembre de 2026');
  assert.equal(mod.formatDeliveryDateShort('2026-09-15'), 'MAR, 15 SEPT');
});

test('12, 15 and 16 September render as their exact selected calendar dates', async () => {
  const mod = await loadDeliveryDateModule();
  assert.equal(mod.formatDeliveryDateLong('2026-09-12'), 'Sábado 12 de septiembre de 2026');
  assert.equal(mod.formatDeliveryDateLong('2026-09-15'), 'Martes 15 de septiembre de 2026');
  assert.equal(mod.formatDeliveryDateLong('2026-09-16'), 'Miércoles 16 de septiembre de 2026');
});

test('missing or invalid delivery date is explicit', async () => {
  const mod = await loadDeliveryDateModule();
  assert.equal(mod.normalizeDeliveryDate(null), null);
  assert.equal(mod.normalizeDeliveryDate(''), null);
  assert.equal(mod.normalizeDeliveryDate('2026-02-31'), null);
  assert.equal(mod.formatDeliveryDateLong(null), 'Fecha de entrega pendiente');
});

test('delivery date sorting is ascending and leaves missing dates at the end', async () => {
  const mod = await loadDeliveryDateModule();
  const orders = [
    { id: 'none', delivery_date: null },
    { id: '16', delivery_date: '2026-09-16' },
    { id: '12', delivery_date: '2026-09-12' },
    { id: '15', delivery_date: '2026-09-15' },
  ];
  assert.deepEqual(
    [...orders].sort(mod.compareDeliveryDates).map((order) => order.id),
    ['12', '15', '16', 'none'],
  );
});

test('delivery date summaries count real production days and missing dates separately', async () => {
  const mod = await loadDeliveryDateModule();
  const summary = mod.summarizeDeliveryDates([
    { delivery_date: '2026-09-12' },
    { delivery_date: '2026-09-12' },
    { delivery_date: '2026-09-15' },
    { delivery_date: '2026-09-16' },
    { delivery_date: null },
  ]);
  assert.deepEqual(summary, [
    { date: '2026-09-12', count: 2 },
    { date: '2026-09-15', count: 1 },
    { date: '2026-09-16', count: 1 },
    { date: null, count: 1 },
  ]);
});
