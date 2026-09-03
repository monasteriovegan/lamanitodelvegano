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

test('endpoint protegido permite ampliar el barrido con un limit acotado', () => {
  const route = read('src/app/api/internal/instagram-backfill/route.ts');
  assert.match(route, /searchParams\.get\(['"]limit['"]\)/);
  assert.match(route, /Math\.min\([^\n]*10/);
  assert.match(route, /limit/);
});

test('backfill permite paginar conversaciones por offset para evitar timeouts', () => {
  const route = read('src/app/api/internal/instagram-backfill/route.ts');
  const source = read('src/lib/meta/instagram-backfill.ts');
  assert.match(route, /searchParams\.get\(['"]offset['"]\)/);
  assert.match(route, /Math\.min\([^\n]*100/);
  assert.match(source, /offset\?:\s*number/);
  assert.match(source, /input\.offset/);
});

test('webhook inválido rechaza por HMAC antes de parsear contenido no verificado', () => {
  const route = read('src/app/api/instagram/route.ts');
  assert.match(route, /request\.arrayBuffer\(\)/);
  assert.match(route, /verifyHmacAny\(rawBody/);
  assert.match(route, /META_INSTAGRAM_APP_SECRET/);
  assert.match(route, /instagram_webhook_signature_rejected/);
  assert.match(route, /invalid_signature/);
  assert.match(route, /status:\s*401/);
  assert.doesNotMatch(route, /unverifiedEnvelopeForDiagnostics/);
  assert.doesNotMatch(route, /unverifiedSenderId|unverifiedRecipientId|unverifiedObject/);
  assert.doesNotMatch(route, /verifyHmacSha1|signatureLegacy/);
});
