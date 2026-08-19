import test from 'node:test';
import assert from 'node:assert/strict';
import { businessTodayYmd, formatDeliveryDateLabel, genFechas } from '../src/lib/pricing/fechas.ts';

function ymd(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

test('usa el día comercial de Chile aunque Vercel ya esté en el día UTC siguiente', () => {
  const instant = new Date('2026-08-19T03:28:00.000Z'); // 18-08-2026 23:28 en Chile
  assert.equal(businessTodayYmd(instant), '2026-08-18');

  const valid = genFechas([], instant).filter((item) => item.ok).map((item) => ymd(item.fecha));
  assert.equal(valid[0], '2026-08-21');
  assert.ok(valid.includes('2026-08-21'));
});

test('formatea fechas de despacho para mostrarlas al cliente', () => {
  assert.match(formatDeliveryDateLabel('2026-08-21'), /viernes.*21.*agosto/i);
});
