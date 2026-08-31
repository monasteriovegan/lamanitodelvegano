import assert from 'node:assert/strict';
import test from 'node:test';

import {
  evaluateMessagingCapability,
  resolveWhatsAppSendMode,
  type MessagingCapability,
  type MessagingActionOrigin,
  type MetaSendMode,
} from '../src/lib/messaging/capability-policy.ts';

type PolicyInput = {
  capability: MessagingCapability;
  channel: 'whatsapp' | 'instagram' | 'web';
  origin: MessagingActionOrigin;
  sendMode: MetaSendMode;
  masterEnabled: boolean;
  channelEnabled: boolean;
  conversationEnabled: boolean;
  humanTakeover: boolean;
  personal: boolean;
};

function base(overrides: Partial<PolicyInput> = {}): PolicyInput {
  return {
    capability: 'send',
    channel: 'whatsapp',
    origin: 'automatic',
    sendMode: 'live',
    masterEnabled: true,
    channelEnabled: true,
    conversationEnabled: true,
    humanTakeover: false,
    personal: false,
    ...overrides,
  };
}

test('META_WHATSAPP_SEND_MODE read_only has precedence over legacy live mode', () => {
  assert.equal(
    resolveWhatsAppSendMode({ META_WHATSAPP_SEND_MODE: 'read_only', META_SEND_MODE: 'live' }),
    'read_only',
  );
});

test('unknown or missing send modes fail closed', () => {
  assert.equal(resolveWhatsAppSendMode({ META_SEND_MODE: 'unexpected' }), 'disabled');
  assert.equal(resolveWhatsAppSendMode({}), 'disabled');
});

test('read_only permits receive and analyze without permitting automatic commerce preparation', () => {
  assert.deepEqual(
    evaluateMessagingCapability(base({ capability: 'receive', sendMode: 'read_only' })),
    { allowed: true, reason: 'receive_allowed' },
  );
  assert.equal(
    evaluateMessagingCapability(base({ capability: 'analyze', sendMode: 'read_only' })).allowed,
    true,
  );
  assert.deepEqual(
    evaluateMessagingCapability(base({ capability: 'prepare', sendMode: 'read_only' })),
    { allowed: false, reason: 'automatic_prepare_blocked' },
  );
});

test('read_only blocks both manual and automatic send', () => {
  for (const origin of ['manual', 'automatic'] as const) {
    assert.deepEqual(
      evaluateMessagingCapability(base({ capability: 'send', origin, sendMode: 'read_only' })),
      { allowed: false, reason: 'send_mode_read_only' },
    );
  }
});

test('manual preparation remains available in read_only when every safety gate is open', () => {
  assert.deepEqual(
    evaluateMessagingCapability(base({ capability: 'prepare', origin: 'manual', sendMode: 'read_only' })),
    { allowed: true, reason: 'prepare_allowed' },
  );
});

test('master, channel and conversation gates block analyze, prepare and send', () => {
  const gates = [
    ['masterEnabled', 'master_disabled'],
    ['channelEnabled', 'channel_disabled'],
    ['conversationEnabled', 'conversation_disabled'],
  ] as const;

  for (const capability of ['analyze', 'prepare', 'send'] as const) {
    for (const [gate, reason] of gates) {
      assert.deepEqual(
        evaluateMessagingCapability(base({ capability, origin: 'manual', [gate]: false })),
        { allowed: false, reason },
      );
    }
  }
});

test('human takeover and personal contacts prevent automatic activity', () => {
  for (const capability of ['analyze', 'prepare', 'send'] as const) {
    assert.deepEqual(
      evaluateMessagingCapability(base({ capability, humanTakeover: true })),
      { allowed: false, reason: 'human_takeover' },
    );
    assert.deepEqual(
      evaluateMessagingCapability(base({ capability, personal: true })),
      { allowed: false, reason: 'personal_contact' },
    );
  }
});

test('disabled send mode blocks WhatsApp and Instagram sends by default', () => {
  for (const channel of ['whatsapp', 'instagram'] as const) {
    assert.deepEqual(
      evaluateMessagingCapability(base({ channel, capability: 'send', sendMode: 'disabled' })),
      { allowed: false, reason: 'send_mode_disabled' },
    );
  }
});

test('live mode permits send only when every gate is open', () => {
  assert.deepEqual(evaluateMessagingCapability(base()), { allowed: true, reason: 'send_allowed' });
});
