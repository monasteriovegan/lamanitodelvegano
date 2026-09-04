import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('analytics centraliza los eventos Meta y GA4', () => {
  const source = read('src/lib/analytics/client.ts');
  for (const event of ['PageView', 'ViewContent', 'AddToCart', 'InitiateCheckout', 'Contact', 'Purchase']) {
    assert.match(source, new RegExp(`['"]${event}['"]`));
  }
  assert.match(source, /const CURRENCY = ['"]CLP['"]/);
  assert.match(source, /content_ids: items\.map/);
});

test('PageView inicial y SPA comparten un guard contra duplicados', () => {
  const source = read('src/components/layout/AnalyticsScripts.tsx');
  assert.match(source, /fbq\('track', 'PageView'\)/);
  assert.match(source, /lastPageViewUrl === routeUrl/);
  assert.match(source, /lastPageViewUrl = routeUrl/);
  assert.match(source, /trackPageView\(window\.location\.href\)/);
  assert.match(source, /__lmvPendingMetaEvents/);
  assert.match(source, /__lmvPendingGoogleEvents/);
  assert.equal((source.match(/fbq\('init'/g) || []).length, 1);
});

test('Purchase exige pago verificado por backend y conserva event id estable', () => {
  const page = read('src/app/pedido/[id]/page.tsx');
  const client = read('src/lib/analytics/client.ts');
  assert.match(page, /pedido\.estado === 'Pagado' && pedido\.payment_status === 'paid'/);
  assert.doesNotMatch(page, /status === 'success'/);
  assert.match(client, /const eventId = `purchase_\$\{orderId\}`/);
});

test('CAPI usa secreto server-side y deduplica Purchase con el Pixel', () => {
  const capi = read('src/lib/meta/conversions-api.ts');
  assert.match(capi, /META_CONVERSIONS_API_ACCESS_TOKEN/);
  assert.match(capi, /\.eq\('payment_status', 'paid'\)/);
  assert.match(capi, /const eventId = `purchase_\$\{order\.id\}`/);
  assert.match(capi, /event_id: eventId/);
  assert.match(capi, /currency: String\(order\.currency \|\| 'CLP'\)/);
  assert.match(capi, /fbp: attribution\?\.fbp/);
  assert.match(capi, /fbc: attribution\?\.fbc/);
  assert.match(capi, /existingDelivery\?\.status === 'sent'/);
  assert.doesNotMatch(capi, /wa_access_token/);
});

test('CAPI se invoca para estado paid y su outbox decide si enviar, deduplicar o reintentar', () => {
  const mercadoPago = read('src/app/api/pagos/mercadopago-webhook/route.ts');
  assert.match(mercadoPago, /if \(effectiveStatus === 'paid'\)/);
  assert.match(mercadoPago, /sendPaidPurchaseToMeta/);
  const capi = read('src/lib/meta/conversions-api.ts');
  assert.match(capi, /status:\s*'pending'/);
  assert.match(capi, /status:\s*'failed'/);
  assert.match(capi, /status:\s*'sent'/);
});

test('diagnóstico CAPI valida autenticación sin enviar eventos', () => {
  const source = read('src/app/api/admin/meta/capi-status/route.ts');
  assert.match(source, /requireRole\(\['admin'\]\)/);
  assert.match(source, /JSON\.stringify\(\{ data: \[\] \}\)/);
  assert.match(source, /eventSent: false/);
  assert.doesNotMatch(source, /accessToken:|token,/);
});

test('contactos públicos instrumentan WhatsApp e Instagram', () => {
  const source = read('src/app/contacto/page.tsx');
  assert.match(source, /trackContact\('whatsapp'\)/);
  assert.match(source, /trackContact\('instagram'\)/);
});

test('checkout espera la hidratación del carrito y evita duplicados', () => {
  const source = read('src/app/checkout/page.tsx');
  assert.match(source, /const checkoutTracked = useRef\(false\)/);
  assert.match(source, /items\.length === 0 \|\| checkoutTracked\.current/);
  assert.match(source, /checkoutTracked\.current = true/);
  assert.match(source, /\[items, subtotal\]/);
  assert.match(source, /'Idempotency-Key': idempotencyKey/);
});
