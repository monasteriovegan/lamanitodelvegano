import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const page = readFileSync(join(process.cwd(), 'src/app/fiestas-patrias-2026/page.tsx'), 'utf8');

test('Fiestas Patrias page announces 17 sold out and empanadas for 18 only', () => {
  assert.match(page, /15, 16 y 17 de septiembre: cupos agotados/);
  assert.match(page, /Solo empanadas disponibles para el 18 de septiembre/);
});
