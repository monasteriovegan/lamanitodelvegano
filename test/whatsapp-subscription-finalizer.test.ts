import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

test('WhatsApp finalizer only verifies the WABA messages subscription', () => {
  const source = readFileSync(
    new URL('../src/app/internal-whatsapp-finalize-7c1d/page.tsx', import.meta.url),
    'utf8',
  );
  assert.match(source, /ensureWabaMessagesSubscription/);
  assert.match(source, /wa_access_token/);
  assert.doesNotMatch(source, /setupMetaMessaging|configureInstagram|pageSubscription/);
  assert.doesNotMatch(source, /access_token\s*:/);
  assert.doesNotMatch(source, /console\./);
});
