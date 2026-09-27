import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  isCutoverFreezeEnabled,
  shouldBlockRequestDuringCutover,
} from '../src/lib/runtime/cutover-freeze.ts';

test('cutover freeze is explicit and disabled by default', () => {
  assert.equal(isCutoverFreezeEnabled({}), false);
  assert.equal(isCutoverFreezeEnabled({ LMV_CUTOVER_FREEZE: 'false' }), false);
  assert.equal(isCutoverFreezeEnabled({ LMV_CUTOVER_FREEZE: 'true' }), true);
});

test('cutover freeze blocks every HTTP mutation so webhooks receive a retryable failure', () => {
  const env = { LMV_CUTOVER_FREEZE: 'true' };
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    assert.equal(shouldBlockRequestDuringCutover('/api/pagos/mercadopago-webhook', method, env), true);
    assert.equal(shouldBlockRequestDuringCutover('/admin/productos', method, env), true);
  }
});

test('cutover freeze blocks every application read except provider verification handshakes', () => {
  const env = { LMV_CUTOVER_FREEZE: 'true' };
  for (const path of [
    '/api/cron/reconcile-pending-sales',
    '/api/internal/reconcile-pending-sales',
    '/api/meta/oauth/start',
    '/api/meta/instagram/oauth/start',
    '/api/admin/conversations/123/messages',
    '/api/worker/attachment',
    '/api/mcp',
    '/api/chat/whatsapp',
    '/internal-whatsapp-finalize-7c1d',
  ]) assert.equal(shouldBlockRequestDuringCutover(path, 'GET', env), true, path);

  for (const path of ['/', '/productos/alfajores', '/api/catalog/products']) {
    assert.equal(shouldBlockRequestDuringCutover(path, 'GET', env), true, path);
  }
  for (const path of ['/api/whatsapp', '/api/instagram']) {
    assert.equal(shouldBlockRequestDuringCutover(path, 'GET', env), false, path);
  }
  assert.equal(shouldBlockRequestDuringCutover('/api/cron/reconcile-pending-sales', 'GET', {}), false);
});

test('Proxy enforces retry-safe freeze responses before admin authentication', () => {
  const proxy = readFileSync(new URL('../src/proxy.ts', import.meta.url), 'utf8');
  assert.match(proxy, /shouldBlockRequestDuringCutover/);
  assert.match(proxy, /Retry-After/);
  assert.match(proxy, /no-store/);
  assert.match(proxy, /Servicio temporalmente en mantenimiento/);
  assert.match(proxy, /text\/html/);
  assert.match(proxy, /\(\?!_next\/static\|_next\/image/);
  assert.ok(proxy.indexOf('shouldBlockRequestDuringCutover') < proxy.indexOf("pathname.startsWith('/admin')"));
});

test('cutover freeze joins Preview safe mode for all external side effects', () => {
  const safety = readFileSync(new URL('../src/lib/runtime/preview-safety.ts', import.meta.url), 'utf8');
  assert.match(safety, /LMV_CUTOVER_FREEZE === 'true'/);
});
