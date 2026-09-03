import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const setup = readFileSync(new URL('../src/lib/meta/setup-messaging.ts', import.meta.url), 'utf8');
const subscription = readFileSync(new URL('../src/lib/meta/waba-subscription.ts', import.meta.url), 'utf8');

test('Meta setup reports WhatsApp Business App message-echo readiness separately', () => {
  assert.match(setup, /smb_message_echoes/);
  assert.match(setup, /coexistenceEchoReady/);
});

test('WABA subscription parsing preserves smb_message_echoes when Meta returns subscribed fields', () => {
  assert.match(subscription, /smb_message_echoes/);
});
