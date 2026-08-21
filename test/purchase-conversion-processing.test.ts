import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

test('purchase pagado se procesa server-side hacia Meta CAPI y actualiza conversion_events', () => {
  const path = 'src/lib/analytics/server-conversions.ts';
  assert.ok(existsSync(join(root, path)), 'falta el procesador server-side de conversiones');
  const source = read(path);

  assert.match(source, /META_CONVERSIONS_API_ACCESS_TOKEN/);
  assert.match(source, /processPaidPurchaseConversion/);
  assert.match(source, /payment_status/);
  assert.match(source, /purchase_\$\{pedidoId\}/);
  assert.match(source, /event_name:\s*['"]Purchase['"]/);
  assert.match(source, /createHash\(['"]sha256['"]\)/);
  assert.match(source, /\bfbc\b/);
  assert.match(source, /\bfbp\b/);
  assert.match(source, /\.from\(['"]conversion_events['"]\)/);
  assert.match(source, /status:\s*['"]processed['"]/);
  assert.match(source, /processed_at:/);
});

test('webhook Mercado Pago dispara conversión sólo después de pago verificado y sin romper el webhook', () => {
  const source = read('src/app/api/pagos/mercadopago-webhook/route.ts');
  assert.match(source, /processPaidPurchaseConversion/);
  assert.match(source, /effectiveStatus\s*===\s*['"]paid['"]/);
  assert.match(source, /purchase_conversion_processing_failed/);
});

test('Pixel browser usa el mismo eventID estable que CAPI para deduplicar Purchase', () => {
  const source = read('src/app/pedido/[id]/PurchaseTracking.tsx');
  assert.match(source, /purchase_\$\{pedidoId\}/);
  assert.match(source, /eventID:\s*eventId/);
  assert.match(source, /transaction_id:\s*pedidoId/);
});
