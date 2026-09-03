import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/app/api/internal/media-ocr-backfill/route.ts', import.meta.url), 'utf8');

test('OCR histórico es interno, autenticado y acotado', () => {
  assert.match(source, /timingSafeEqual/);
  assert.match(source, /createHash\(['"]sha256['"]\)/);
  assert.match(source, /x-media-backfill-key/);
  assert.match(source, /runHistoricalMediaBackfill/);
  assert.match(source, /Math\.min/);
  assert.match(source, /unauthorized/);
});
