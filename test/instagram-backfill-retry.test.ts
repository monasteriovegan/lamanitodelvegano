import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const source = readFileSync(join(process.cwd(), 'src/lib/meta/instagram-backfill.ts'), 'utf8');

test('backfill trata Timeout de Graph como transitorio y reintenta sin exponer credenciales', () => {
  assert.match(source, /isRetryableGraphError/);
  assert.match(source, /timeout/i);
  assert.match(source, /setTimeout/);
  assert.doesNotMatch(source, /console\.(?:log|warn|error)\([^\n]*(?:accessToken|pageToken|storedToken)/);
});

test('backfill separa listado de conversaciones, ids de mensajes y detalle de cada mensaje', () => {
  assert.match(source, /conversations\?platform=instagram&fields=id/);
  assert.match(source, /messages\.limit\(20\)\{id,created_time\}/);
  assert.match(source, /fields=id,created_time,from,to,message/);
});
