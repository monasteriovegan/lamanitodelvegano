import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('browser analytics persist canonical first-party events without depending on Meta or GA4', () => {
  const client = read('src/lib/analytics/client.ts');
  assert.match(client, /\/api\/analytics\/events/);
  assert.match(client, /persistFirstPartyEvent\(['"]PageView['"]/);
  assert.match(client, /persistFirstPartyEvent\(['"]ViewContent['"]/);
  assert.match(client, /persistFirstPartyEvent\(['"]AddToCart['"]/);
  assert.match(client, /persistFirstPartyEvent\(['"]InitiateCheckout['"]/);
  assert.match(client, /persistFirstPartyEvent\(['"]Contact['"]/);
});

test('first-party analytics ingestion is a validated server endpoint backed by analytics_events', () => {
  const routePath = new URL('../src/app/api/analytics/events/route.ts', import.meta.url);
  assert.equal(existsSync(routePath), true, 'missing /api/analytics/events ingestion route');
  if (!existsSync(routePath)) return;

  const route = read('src/app/api/analytics/events/route.ts');
  assert.match(route, /analytics_events/);
  assert.match(route, /BusinessRepository/);
  assert.match(route, /PageView/);
  assert.match(route, /ViewContent/);
  assert.match(route, /AddToCart/);
  assert.match(route, /InitiateCheckout/);
  assert.match(route, /Contact/);
  assert.match(route, /origin/i);
});

test('Wonka metrics uses canonical browser events plus server-authoritative web checkout and purchase', () => {
  const page = read('src/app/admin/metricas/page.tsx');

  assert.match(page, /analytics_events/);
  assert.match(page, /conversion_events/);
  for (const event of ['PageView', 'ViewContent', 'AddToCart', 'InitiateCheckout', 'Purchase', 'Contact']) {
    assert.match(page, new RegExp(event));
  }

  assert.match(page, /webOrderIds/);
  assert.match(page, /order_id/);
  assert.doesNotMatch(page, /click_pedir_whatsapp|abrir_catalogo|consultar_producto_whatsapp/);
  assert.doesNotMatch(page, /Asegúrate de configurar las variables de Meta Pixel y GA4 en producción/);
});
