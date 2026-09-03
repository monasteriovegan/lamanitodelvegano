import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const path = 'src/app/api/internal/instagram-history-scan/route.ts';

test('scanner histórico de Instagram es interno, paginado y no expone credenciales', () => {
  assert.equal(existsSync(join(root, path)), true);
  const source = readFileSync(join(root, path), 'utf8');
  assert.match(source, /createHash\(['"]sha256['"]\)/);
  assert.match(source, /timingSafeEqual/);
  assert.match(source, /getInstagramLoginCredential/);
  assert.match(source, /graph\.instagram\.com/);
  assert.match(source, /searchParams\.get\(['"]offset['"]\)/);
  assert.match(source, /searchParams\.get\(['"]limit['"]\)/);
  assert.match(source, /fields=id,name,username/);
  assert.doesNotMatch(source, /accessToken\s*[,}]/);
  assert.doesNotMatch(source, /token:/);
});

test('scanner distingue el id de Instagram Login del asset profesional de mensajería', () => {
  const source = readFileSync(join(root, path), 'utf8');
  assert.match(source, /getActiveCredential\([\s\S]*instagram_account/);
  assert.match(source, /businessIds/);
  assert.match(source, /routingCredential\.externalId/);
  assert.match(source, /credential\.externalId/);
  assert.match(source, /businessIds\.has/);
  assert.match(source, /counterpartyFromParticipants\([\s\S]*businessIds/);
});

test('scanner puede ampliar mensajes para auditar el total corregido sin quitar límites', () => {
  const source = readFileSync(join(root, path), 'utf8');
  assert.match(source, /searchParams\.get\(['"]message_limit['"]\)/);
  assert.match(source, /Math\.min\([^\n]*50/);
  assert.match(source, /messageLimit/);
  assert.match(source, /messages\.limit\(\$\{input\.messageLimit\}\)/);
});

test('scanner histórico conserva adjuntos para identificar vouchers sin texto', () => {
  const source = readFileSync(join(root, path), 'utf8');
  assert.match(source, /fields=id,created_time,from,to,message,attachments/);
  assert.match(source, /attachments:/);
  assert.match(source, /payload\?\.url/);
});
