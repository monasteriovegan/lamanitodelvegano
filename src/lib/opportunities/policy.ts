import type { OpportunityChannel } from './types';

export type OpportunityPolicyInput = {
  channel: OpportunityChannel;
  aiEnabled: boolean;
  sendMode: 'disabled' | 'read_only' | 'live';
  channelEnabled: boolean;
  conversationEnabled: boolean;
  humanTakeover: boolean;
  personal: boolean;
  paidOrder: boolean;
  dismissed: boolean;
  optedOut: boolean;
  followupCount: number;
  lastBusinessMessageAt?: string | null;
  lastFollowupAt?: string | null;
  now?: string;
};

export type OpportunityPolicyDecision = {
  recommend: boolean;
  automaticSend: boolean;
  reason: string;
  nextFollowupAt: string | null;
};

function addHours(iso: string, hours: number) {
  return new Date(new Date(iso).getTime() + hours * 60 * 60 * 1000).toISOString();
}

export function evaluateOpportunityPolicy(input: OpportunityPolicyInput): OpportunityPolicyDecision {
  const now = input.now || new Date().toISOString();
  if (input.humanTakeover) return { recommend: false, automaticSend: false, reason: 'human_takeover', nextFollowupAt: null };
  if (input.personal) return { recommend: false, automaticSend: false, reason: 'personal_contact', nextFollowupAt: null };
  if (input.paidOrder) return { recommend: false, automaticSend: false, reason: 'paid_order', nextFollowupAt: null };
  if (input.dismissed) return { recommend: false, automaticSend: false, reason: 'dismissed', nextFollowupAt: null };
  if (input.optedOut) return { recommend: false, automaticSend: false, reason: 'opted_out', nextFollowupAt: null };
  if (input.followupCount >= 2) return { recommend: false, automaticSend: false, reason: 'followup_limit', nextFollowupAt: null };

  const baseAt = input.followupCount > 0
    ? (input.lastFollowupAt || now)
    : (input.lastBusinessMessageAt || now);
  const nextFollowupAt = addHours(baseAt, input.followupCount > 0 ? 24 : 2);
  const due = new Date(now).getTime() >= new Date(nextFollowupAt).getTime();
  const channelAllowsAuto = input.channel === 'whatsapp'
    ? input.sendMode === 'live'
    : input.sendMode !== 'disabled';
  const automaticSend = Boolean(
    due &&
    input.aiEnabled &&
    input.channelEnabled &&
    input.conversationEnabled &&
    channelAllowsAuto
  );

  if (!input.aiEnabled) return { recommend: true, automaticSend: false, reason: 'remy_off_copilot', nextFollowupAt };
  if (!input.channelEnabled) return { recommend: true, automaticSend: false, reason: 'channel_disabled', nextFollowupAt };
  if (!input.conversationEnabled) return { recommend: true, automaticSend: false, reason: 'conversation_disabled', nextFollowupAt };
  if (!channelAllowsAuto) return { recommend: true, automaticSend: false, reason: input.sendMode === 'read_only' ? 'send_mode_read_only' : 'send_mode_disabled', nextFollowupAt };
  if (!due) return { recommend: true, automaticSend: false, reason: 'not_due', nextFollowupAt };
  return { recommend: true, automaticSend, reason: automaticSend ? 'automatic_send_allowed' : 'manual_only', nextFollowupAt };
}
