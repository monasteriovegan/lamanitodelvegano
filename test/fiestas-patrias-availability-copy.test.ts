import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const page = readFileSync(join(process.cwd(), 'src/app/fiestas-patrias-2026/page.tsx'), 'utf8');
const checkout = readFileSync(join(process.cwd(), 'src/app/api/checkout/route.ts'), 'utf8');

test('Fiestas Patrias page announces 17 sold out and empanadas for 18 only', () => {
  assert.match(page, /15, 16 y 17 de septiembre: cupos agotados/);
  assert.match(page, /Solo empanadas disponibles para el 18 de septiembre/);
  assert.match(page, /2026-09-18/);
  assert.match(page, /170fb7d9-947a-406e-bcb1-338d1e98f6df/);
});

test('checkout fail-closes sold-out Fiestas products and only overrides empanadas to Sep 18', () => {
  assert.match(checkout, /FIESTAS_PATRIAS_EMPANADA_ID/);
  assert.match(checkout, /FIESTAS_PATRIAS_CLOSED_PRODUCT_IDS/);
  assert.match(checkout, /2026-09-18/);
  assert.match(checkout, /170fb7d9-947a-406e-bcb1-338d1e98f6df/);

  // These canonical products were reused by the active weekend campaign. Their
  // historical September dates now fall back to the normal delivery calendar,
  // so the legacy sold-out guard must not make the new campaign impossible to buy.
  for (const activeWeekendProductId of [
    'bac7659e-b2e2-4603-8a59-75b0425c969c',
    '63a7bd54-5386-44bc-a7d7-998ad71daa92',
    '04bacb84-95ff-4f03-99ff-0b103ae65ea0',
    '8df2cb6f-f15d-4710-a8e6-d8c818e5e25f',
    '18853adf-28bd-4ba6-afd6-d86b9280c780',
  ]) {
    assert.doesNotMatch(checkout, new RegExp(activeWeekendProductId));
  }
});
