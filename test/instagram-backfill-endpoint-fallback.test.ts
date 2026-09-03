import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const source = readFileSync(join(process.cwd(), 'src/lib/meta/instagram-backfill.ts'), 'utf8');

test('backfill prioriza Instagram Login para recuperar conversaciones', () => {
  assert.match(source, /getInstagramLoginCredential/);
  assert.match(source, /graph\.instagram\.com/);
  assert.match(source, /instagram_business_manage_messages|instagram_login/i);
});

test('backfill histórico conserva el Instagram asset canónico para resolver el tenant', () => {
  assert.match(source, /business_instagram_id/);
  assert.match(source, /routingBusinessInstagramId|businessInstagramId/);
});

test('backfill conserva el username real de Instagram para identificar al cliente', () => {
  assert.match(source, /username/);
  assert.match(source, /usernames/);
});

test('recuperación dirigida usa hasta 50 mensajes sin volver pesado el barrido general', () => {
  assert.match(source, /messageLimit/);
  assert.match(source, /input\.userId\s*\?\s*50\s*:\s*20/);
  assert.match(source, /messages\.limit\(\$\{input\.messageLimit\}\)/);
});

test('backfill histórico conserva imágenes y rehidrata duplicados vacíos', () => {
  assert.match(source, /attachments\{image_data,video_data,file_url,mime_type,name\}/);
  assert.match(source, /historyAttachments/);
  assert.match(source, /message_type:\s*attachmentType/);
  assert.match(source, /hydrateHistoricalDuplicate/);
  assert.match(source, /processInboundImageOcrAsync/);
});

test('un fallo al extraer la venta no invalida la recuperación histórica ya persistida', () => {
  assert.match(source, /instagram_backfill_sale_sync_failed/);
  assert.match(source, /try\s*\{[\s\S]*autoRegisterInstagramConversationSale[\s\S]*catch/);
});

test('backfill conserva Facebook Login como fallback si Instagram Login no está disponible', () => {
  assert.match(source, /getActiveCredential/);
  assert.match(source, /discoverConversationSource/);
  assert.match(source, /targetId:\s*['"]me['"]/);
  assert.match(source, /targetId:\s*input\.pageId/);
  assert.match(source, /targetId:\s*input\.businessInstagramId/);
  assert.match(source, /v25\.0/);
  assert.match(source, /v24\.0/);
});
