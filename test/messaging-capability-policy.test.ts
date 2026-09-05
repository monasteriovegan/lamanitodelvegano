import assert from 'node:assert/strict';
import test from 'node:test';

import {
  automaticRepliesEnabled,
  evaluateAutomaticWhatsAppReplyEntry,
  evaluateMessagingCapability,
  resolveChannelSendMode,
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

test('database channel settings resolve disabled, read_only and live modes', () => {
  assert.equal(resolveChannelSendMode(null), 'disabled');
  assert.equal(resolveChannelSendMode({ enabled: false, read_only_mode: false }), 'disabled');
  assert.equal(resolveChannelSendMode({ enabled: true, read_only_mode: true }), 'read_only');
  assert.equal(resolveChannelSendMode({ enabled: true, read_only_mode: false }), 'live');
});

test('automatic replies require enabled + auto_reply + non-read-only database settings', () => {
  assert.equal(automaticRepliesEnabled({ enabled: true, auto_reply_enabled: true, read_only_mode: false }), true);
  assert.equal(automaticRepliesEnabled({ enabled: true, auto_reply_enabled: false, read_only_mode: false }), false);
  assert.equal(automaticRepliesEnabled({ enabled: true, auto_reply_enabled: true, read_only_mode: true }), false);
  assert.equal(automaticRepliesEnabled({ enabled: false, auto_reply_enabled: true, read_only_mode: false }), false);
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

test('automatic WhatsApp entry stops read_only before any Remy dependency can run', () => {
  let dependencyCalls = 0;
  const decision = evaluateAutomaticWhatsAppReplyEntry({
    channel: 'whatsapp',
    sendMode: 'read_only',
    afterGuard: () => { dependencyCalls += 1; },
  });

  assert.deepEqual(decision, { allowed: false, reason: 'send_mode_read_only' });
  assert.equal(dependencyCalls, 0);
});

test('automatic WhatsApp entry continues only in live mode', () => {
  let dependencyCalls = 0;
  const decision = evaluateAutomaticWhatsAppReplyEntry({
    channel: 'whatsapp',
    sendMode: 'live',
    afterGuard: () => { dependencyCalls += 1; },
  });

  assert.deepEqual(decision, { allowed: true, reason: 'automatic_reply_allowed' });
  assert.equal(dependencyCalls, 1);
});
