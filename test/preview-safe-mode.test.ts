import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Preview safe mode blocks payment, email and outbound social side effects before provider calls', () => {
  const payment = read('src/lib/payments/payment-link.ts');
  const capi = read('src/lib/meta/conversions-api.ts');
  const email = read('src/lib/email/resend.ts');
  const whatsapp = read('src/lib/messaging/transports/whatsapp-cloud.ts');
  const instagram = read('src/lib/messaging/transports/instagram-meta.ts');

  assert.match(payment, /assertExternalSideEffectsAllowed\('payment'/);
  assert.match(capi, /externalSideEffectsBlocked\(\)/);
  assert.match(email, /externalSideEffectsBlocked\(\)/);
  assert.match(whatsapp, /assertExternalSideEffectsAllowed\('whatsapp_outbound'/);
  assert.match(instagram, /assertExternalSideEffectsAllowed\('instagram_outbound'/);
});

test('Preview safe mode is activated by Vercel Preview or an explicit environment flag', () => {
  const safety = read('src/lib/runtime/preview-safety.ts');
  assert.match(safety, /VERCEL_ENV === 'preview'/);
  assert.match(safety, /LMV_PREVIEW_SAFE_MODE === 'true'/);
  assert.match(safety, /preview_safe_mode:/);
});
