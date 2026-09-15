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
});
