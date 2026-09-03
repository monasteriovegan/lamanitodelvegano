import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/lib/messaging/ocr.ts', import.meta.url), 'utf8');

test('OCR histórico usa payload.raw y no la columna eliminada raw_payload', () => {
  assert.doesNotMatch(source, /select\([^)]*raw_payload/);
  assert.match(source, /msg\.payload[^\n]*\.raw/);
});

test('OCR histórico distingue Instagram de WhatsApp por transport', () => {
  assert.match(source, /transport/);
  assert.match(source, /cloud_api/);
  assert.match(source, /instagram_api/);
});
