import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

function read(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('dominio oficial centraliza canonical, sitemap y robots', () => {
  const site = read('src/lib/site-url.ts');
  const layout = read('src/app/layout.tsx');
  const sitemap = read('src/app/sitemap.ts');
  const robots = read('src/app/robots.ts');
  assert.match(site, /OFFICIAL_SITE_URL = 'https:\/\/lamanitodelvegano\.cl'/);
  assert.match(layout, /metadataBase: new URL\(OFFICIAL_SITE_URL\)/);
  assert.match(layout, /alternates: \{ canonical: '\/' \}/);
  assert.match(sitemap, /OFFICIAL_SITE_URL/);
  assert.match(robots, /OFFICIAL_SITE_URL/);
});

test('www redirige permanentemente al dominio raíz', () => {
  const config = read('next.config.ts');
  assert.match(config, /value: 'www\.lamanitodelvegano\.cl'/);
  assert.match(config, /destination: 'https:\/\/lamanitodelvegano\.cl\/:path\*'/);
  assert.match(config, /permanent: true/);
});

test('callbacks y enlaces server-side reutilizan la URL operativa central', () => {
  for (const path of [
    'src/lib/meta/setup-messaging.ts',
    'src/lib/meta/conversions-api.ts',
    'src/lib/payments/payment-link.ts',
    'src/lib/orders/order-notifications.ts',
    'src/lib/ai/remy-commerce.ts',
  ]) {
    assert.match(read(path), /runtimeSiteUrl/);
  }
});

test('URLs legales requeridas por Meta existen sin duplicados', () => {
  assert.match(read('src/app/privacidad/page.tsx'), /Política de Privacidad/);
  assert.match(read('src/app/terminos/page.tsx'), /Términos y Condiciones/);
  assert.match(read('src/app/eliminacion-de-datos/page.tsx'), /Eliminación de datos/);
});
