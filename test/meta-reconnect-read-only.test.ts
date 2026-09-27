import assert from 'node:assert/strict';
import test from 'node:test';
import { metaReconnectReadOnly } from '../src/lib/meta/reconnect-policy.ts';

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
