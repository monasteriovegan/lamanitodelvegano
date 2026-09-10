import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('conversation sale extractor consumes the safe OCR transcript helper', () => {
  const source = readFileSync(
    new URL('../src/lib/orders/conversation-sale.ts', import.meta.url),
    'utf8',
  );

  assert.match(source, /buildConversationSaleTranscript/);
  assert.match(source, /buildConversationSaleTranscript\(\[\.\.\.\(rawMessages \|\| \[\]\)\]\.reverse\(\)\)/);
});

test('WhatsApp image OCR completion retries sale reconciliation after OCR is persisted', () => {
  const source = readFileSync(
    new URL('../src/lib/messaging/messages.ts', import.meta.url),
    'utf8',
  );

  assert.match(source, /processInboundImageOcrAsync\(/);
  assert.match(source, /autoRegisterWhatsappConversationSale/);
  assert.match(source, /image_ocr_sale_reconcile_failed/);
});

test('transactional order notifications remain deterministic system messages, not Remy replies', () => {
  const source = readFileSync(
    new URL('../src/lib/orders/order-notifications.ts', import.meta.url),
    'utf8',
  );

  assert.match(source, /source:\s*'order_status_notification'/);
  assert.match(source, /deterministic:\s*true/);
  assert.match(source, /agent:\s*'system'/);
  assert.match(source, /sender_type:\s*'system'/);
  assert.doesNotMatch(source, /agent:\s*'remy'/);
  assert.doesNotMatch(source, /callAiProvider|generateContent|chatCompletion/);
});

test('order detail exposes download and native share fallbacks without requiring the printer', () => {
  const page = readFileSync(
    new URL('../src/app/admin/pedidos/[id]/page.tsx', import.meta.url),
    'utf8',
  );
  const portable = readFileSync(
    new URL('../src/app/admin/pedidos/[id]/OrderPortableActions.tsx', import.meta.url),
    'utf8',
  );

  assert.match(page, /OrderPortableActions/);
  assert.match(portable, /Descargar pedido/);
  assert.match(portable, /Compartir pedido/);
  assert.match(portable, /new Blob\(/);
  assert.match(portable, /navigator\.share/);
  assert.match(portable, /navigator\.clipboard/);
  assert.doesNotMatch(portable, /\/api\/public|publicUrl|upload\(/);
});
