import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

test('rewire de Instagram conserva HMAC y verifica la app principal en subscribed_apps', () => {
  const helperPath = 'src/lib/meta/instagram-webhook-rewire.ts';
  assert.equal(existsSync(join(root, helperPath)), true);
  const source = read(helperPath);
  assert.match(source, /configureInstagramAppCallback/);
  assert.match(source, /subscribed_apps/);
  assert.match(source, /META_APP_ID/);
  assert.match(source, /primaryAppSubscribed/);
  assert.doesNotMatch(source, /invalid_signature[^\n]*200/);
});

test('rewire intenta credencial multitenant y token legado sin exponerlos', () => {
  const source = read('src/lib/meta/instagram-webhook-rewire.ts');
  assert.match(source, /MetaConnectionsRepository/);
  assert.match(source, /legacyPageToken/);
  assert.match(source, /credential\.accessToken/);
  assert.doesNotMatch(source, /console\.(?:log|warn|error)\([^\n]*(?:accessToken|legacyPageToken)/);
});

test('trigger interno de rewire usa la misma llave derivada y no es público', () => {
  const routePath = 'src/app/api/internal/instagram-webhook-rewire/route.ts';
  assert.equal(existsSync(join(root, routePath)), true);
  const route = read(routePath);
  assert.match(route, /createHash\(['"]sha256['"]\)/);
  assert.match(route, /timingSafeEqual/);
  assert.match(route, /rewireInstagramWebhook/);
  assert.match(route, /wa_verify_token/);
  assert.match(route, /unauthorized/);
});

test('setup Meta expone la configuración de callback para reutilizarla sin duplicar secretos', () => {
  const setup = read('src/lib/meta/setup-messaging.ts');
  assert.match(setup, /export async function configureInstagramAppCallback/);
  assert.match(setup, /META_APP_SECRET/);
});
