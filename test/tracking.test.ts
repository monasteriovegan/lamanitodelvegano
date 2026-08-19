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
  assert.equal((source.match(/fbq\('init'/g) || []).length, 1);
});

test('Purchase exige pago verificado por backend y conserva event id estable', () => {
  const page = read('src/app/pedido/[id]/page.tsx');
  const client = read('src/lib/analytics/client.ts');
  assert.match(page, /pedido\.status === 'Pagado' && pedido\.payment_status === 'paid'/);
  assert.doesNotMatch(page, /status === 'success'/);
  assert.match(client, /const eventId = `purchase_\$\{orderId\}`/);
});

test('contactos públicos instrumentan WhatsApp e Instagram', () => {
  const source = read('src/app/contacto/page.tsx');
  assert.match(source, /trackContact\('whatsapp'\)/);
  assert.match(source, /trackContact\('instagram'\)/);
});
