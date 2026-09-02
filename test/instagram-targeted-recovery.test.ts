import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

test('backfill de Instagram soporta recuperación dirigida por user_id', () => {
  const source = read('src/lib/meta/instagram-backfill.ts');
  assert.match(source, /userId\?:\s*string/);
  assert.match(source, /user_id/);
  assert.match(source, /targeted/);
  assert.match(source, /persistMessage/);
  assert.match(source, /autoRegisterInstagramConversationSale/);
});

test('endpoint protegido acepta user_id numérico sin quitar autorización', () => {
  const route = read('src/app/api/internal/instagram-backfill/route.ts');
  assert.match(route, /searchParams\.get\(['"]user_id['"]\)/);
  assert.match(route, /^.*\^\\d\+\$.*$/m);
  assert.match(route, /createHash\(['"]sha256['"]\)/);
  assert.match(route, /timingSafeEqual/);
  assert.match(route, /userId/);
});

test('webhook inválido solo expone ID candidato y sigue respondiendo 401', () => {
  const route = read('src/app/api/instagram/route.ts');
  assert.match(route, /unverifiedSenderId/);
  assert.match(route, /instagram_webhook_signature_rejected/);
  assert.match(route, /invalid_signature/);
  assert.match(route, /status:\s*401/);
});
