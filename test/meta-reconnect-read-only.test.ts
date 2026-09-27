import assert from 'node:assert/strict';
import test from 'node:test';
import { metaReconnectFailureCode, metaReconnectReadOnly } from '../src/lib/meta/reconnect-policy.ts';

test('Meta reconnection is read-only by default', () => {
  assert.equal(metaReconnectReadOnly({}), true);
});

test('Preview safe mode cannot subscribe Meta webhooks even with an explicit live request', () => {
  assert.equal(metaReconnectReadOnly({
    LMV_PREVIEW_SAFE_MODE: '1',
    META_RECONNECT_MODE: 'live',
  }), true);
});

test('Meta webhook subscription requires an explicit live reconnect mode outside safe mode', () => {
  assert.equal(metaReconnectReadOnly({
    LMV_PREVIEW_SAFE_MODE: '0',
    META_RECONNECT_MODE: 'live',
  }), false);
});

test('decrypt and token health failures request reauthorization instead of blaming webhooks', () => {
  assert.equal(metaReconnectFailureCode('decrypt'), 'reauthorization_required');
  assert.equal(metaReconnectFailureCode('health'), 'reauthorization_required');
  assert.equal(metaReconnectFailureCode('subscribe'), 'webhook_subscription_failed');
});
