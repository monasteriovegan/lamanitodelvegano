export type MessagingCapability = 'receive' | 'analyze' | 'prepare' | 'send';
export type MetaSendMode = 'disabled' | 'read_only' | 'live';
export type MessagingActionOrigin = 'automatic' | 'manual';

type MessagingChannel = 'whatsapp' | 'instagram' | 'web';

export type MessagingChannelSettings = {
  enabled?: boolean | null;
  auto_reply_enabled?: boolean | null;
  read_only_mode?: boolean | null;
};

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

/**
 * Canonical transport mode derived from the persisted channel_settings row.
 * Vercel META_* send-mode variables are intentionally not consulted here:
 * production on/off is controlled from the database.
 */
export function resolveChannelSendMode(settings: MessagingChannelSettings | null | undefined): MetaSendMode {
  if (settings?.enabled !== true) return 'disabled';
  if (settings?.read_only_mode === true) return 'read_only';
  return 'live';
}

export function automaticRepliesEnabled(settings: MessagingChannelSettings | null | undefined) {
  return settings?.enabled === true
    && settings?.auto_reply_enabled === true
    && settings?.read_only_mode !== true;
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

export function evaluateAutomaticWhatsAppReplyEntry(input: {
  channel: string;
  sendMode: MetaSendMode;
  afterGuard: () => void;
}): MessagingCapabilityDecision {
  if (input.channel === 'whatsapp') {
    if (input.sendMode === 'read_only') {
      return { allowed: false, reason: 'send_mode_read_only' };
    }
    if (input.sendMode !== 'live') {
      return { allowed: false, reason: 'send_mode_disabled' };
    }
  }

  input.afterGuard();
  return { allowed: true, reason: 'automatic_reply_allowed' };
}
