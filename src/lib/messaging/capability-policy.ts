export type MessagingCapability = 'receive' | 'analyze' | 'prepare' | 'send';
export type MetaSendMode = 'disabled' | 'read_only' | 'live';
export type MessagingActionOrigin = 'automatic' | 'manual';

type MessagingChannel = 'whatsapp' | 'instagram' | 'web';

export type MessagingCapabilityInput = {
  capability: MessagingCapability;
  channel: MessagingChannel;
  origin: MessagingActionOrigin;
  sendMode: MetaSendMode;
  masterEnabled: boolean;
  channelEnabled: boolean;
  conversationEnabled: boolean;
  humanTakeover: boolean;
  personal: boolean;
};

export type MessagingCapabilityDecision = {
  allowed: boolean;
  reason: string;
};

export function resolveWhatsAppSendMode(
  env: Record<string, string | undefined> = process.env,
): MetaSendMode {
  const normalized = String(
    env.META_WHATSAPP_SEND_MODE || env.META_SEND_MODE || 'disabled',
  ).toLowerCase();

  if (normalized === 'live') return 'live';
  if (normalized === 'read_only') return 'read_only';
  return 'disabled';
}

function blockedBySafetyGate(input: MessagingCapabilityInput): MessagingCapabilityDecision | null {
  if (!input.masterEnabled) return { allowed: false, reason: 'master_disabled' };
  if (!input.channelEnabled) return { allowed: false, reason: 'channel_disabled' };
  if (!input.conversationEnabled) return { allowed: false, reason: 'conversation_disabled' };
  if (input.humanTakeover) return { allowed: false, reason: 'human_takeover' };
  if (input.personal) return { allowed: false, reason: 'personal_contact' };
  return null;
}

export function evaluateMessagingCapability(
  input: MessagingCapabilityInput,
): MessagingCapabilityDecision {
  if (input.capability === 'receive') {
    return { allowed: true, reason: 'receive_allowed' };
  }

  const blocked = blockedBySafetyGate(input);
  if (blocked) return blocked;

  if (input.capability === 'analyze') {
    return { allowed: true, reason: 'analyze_allowed' };
  }

  if (input.capability === 'prepare') {
    return input.origin === 'manual'
      ? { allowed: true, reason: 'prepare_allowed' }
      : { allowed: false, reason: 'automatic_prepare_blocked' };
  }

  if (input.sendMode === 'read_only') {
    return { allowed: false, reason: 'send_mode_read_only' };
  }
  if (input.sendMode !== 'live') {
    return { allowed: false, reason: 'send_mode_disabled' };
  }

  return { allowed: true, reason: 'send_allowed' };
}
