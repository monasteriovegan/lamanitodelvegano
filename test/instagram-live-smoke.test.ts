import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

test('smoke de Instagram solo usa el hilo histórico de prueba y exige llave derivada', () => {
  const path = 'src/app/api/internal/instagram-live-smoke/route.ts';
  assert.equal(existsSync(join(root, path)), true);
  const source = read(path);
  assert.match(source, /createHash\(['"]sha256['"]\)/);
  assert.match(source, /timingSafeEqual/);
  assert.match(source, /Hola Remy/);
  assert.match(source, /Quiero una barra Dubai/);
  assert.match(source, /order_id/);
  assert.match(source, /sendInstagramMeta/);
  assert.match(source, /manual:\s*true/);
  assert.match(source, /Prueba técnica automática de integración Instagram\/CRM/);
});
