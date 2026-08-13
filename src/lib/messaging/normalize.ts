import type { NormalizedMessage } from './types';

export function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, '');
  return digits.startsWith('56')
    ? digits
    : digits.length === 9 && digits.startsWith('9')
      ? `56${digits}`
      : digits;
}

function messageText(message: any): string | null {
  return message?.text?.body ?? message?.text ?? message?.button?.text ?? message?.postback?.title ?? null;
}

function messageType(message: any): string {
  if (message?.type) return String(message.type);
  if (message?.attachments?.length) return String(message.attachments[0]?.type || 'attachment');
  if (message?.postback) return 'postback';
  if (message?.text) return 'text';
  return 'unknown';
}

export function normalizeMetaWhatsApp(payload: any): NormalizedMessage[] {
  const normalized: NormalizedMessage[] = [];

  for (const entry of payload?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      const value = change?.value ?? {};

      for (const message of value.messages ?? []) {
        const from = normalizePhone(String(message.from ?? ''));
        if (!from || !message.id) continue;

        normalized.push({
          channel: 'whatsapp',
          provider: 'meta',
          transport: 'cloud_api',
          provider_message_id: String(message.id),
          external_thread_id: from,
          external_user_id: from,
          direction: 'inbound',
          sender_type: 'customer',
          text: message.text?.body ?? message.button?.text ?? null,
          message_type: String(message.type ?? 'unknown'),
          sent_at: new Date(Number(message.timestamp ?? Date.now() / 1000) * 1000).toISOString(),
          raw_payload: { metadata: value.metadata, contacts: value.contacts, message },
          display_name: value.contacts?.[0]?.profile?.name ?? null,
        });
      }

      // WhatsApp Business App coexistence: messages sent manually from the phone
      // arrive as smb_message_echoes. They must be mirrored as human outbound
      // messages in the same CRM conversation, without an LLM call.
      for (const echo of value.message_echoes ?? []) {
        const to = normalizePhone(String(echo.to ?? ''));
        if (!to || !echo.id) continue;

        normalized.push({
          channel: 'whatsapp',
          provider: 'meta',
          transport: 'cloud_api',
          provider_message_id: String(echo.id),
          external_thread_id: to,
          external_user_id: to,
          direction: 'outbound',
          sender_type: 'human',
          text: echo.text?.body ?? echo.button?.text ?? null,
          message_type: String(echo.type ?? 'unknown'),
          sent_at: new Date(Number(echo.timestamp ?? Date.now() / 1000) * 1000).toISOString(),
          raw_payload: { metadata: value.metadata, message_echo: echo, source: 'whatsapp_business_app' },
        });
      }

      for (const status of value.statuses ?? []) {
        if (!status.id) continue;
        const recipient = normalizePhone(String(status.recipient_id ?? ''));
        normalized.push({
          channel: 'whatsapp',
          provider: 'meta',
          transport: 'cloud_api',
          provider_message_id: `status:${status.id}:${status.status}`,
          external_thread_id: recipient,
          external_user_id: recipient,
          direction: 'outbound',
          sender_type: 'system',
          text: null,
          message_type: `status:${status.status}`,
          sent_at: new Date(Number(status.timestamp ?? Date.now() / 1000) * 1000).toISOString(),
          raw_payload: { metadata: value.metadata, status },
        });
      }
    }
  }

  return normalized;
}

export function normalizeMetaInstagram(payload: any): NormalizedMessage[] {
  const normalized: NormalizedMessage[] = [];
  if (payload?.object !== 'instagram') return normalized;

  for (const entry of payload?.entry ?? []) {
    const businessId = String(entry?.id ?? '');
    if (!businessId) continue;

    for (const event of entry?.messaging ?? []) {
      const senderId = String(event?.sender?.id ?? '');
      const recipientId = String(event?.recipient?.id ?? '');
      const message = event?.message;
      const postback = event?.postback;
      const mid = String(message?.mid ?? postback?.mid ?? `ig:${entry?.time ?? Date.now()}:${senderId}:${recipientId}`);
      if (!senderId || !recipientId || (!message && !postback)) continue;

      // Instagram includes business-originated echoes in the same `messages`
      // subscription. The counterparty is whichever id is not the professional
      // account id from entry.id.
      const outbound = senderId === businessId;
      const counterpartyId = outbound ? recipientId : senderId;
      if (!counterpartyId) continue;

      const eventBody = message ?? postback;
      const text = messageText(eventBody);
      const type = messageType(eventBody);
      const timestamp = Number(event?.timestamp ?? entry?.time ?? Date.now());

      normalized.push({
        channel: 'instagram',
        provider: 'meta',
        transport: 'cloud_api',
        provider_message_id: mid,
        external_thread_id: counterpartyId,
        external_user_id: counterpartyId,
        direction: outbound ? 'outbound' : 'inbound',
        sender_type: outbound ? 'human' : 'customer',
        text,
        message_type: type,
        sent_at: new Date(timestamp > 10_000_000_000 ? timestamp : timestamp * 1000).toISOString(),
        raw_payload: {
          business_instagram_id: businessId,
          event,
          is_echo: Boolean(message?.is_echo) || outbound,
        },
        display_name: null,
      });
    }
  }

  return normalized;
}

export function normalizeBaileys(payload: any): NormalizedMessage {
  const phone = normalizePhone(String(payload.phone ?? payload.remoteJid ?? ''));
  return {
    channel: 'whatsapp',
    provider: 'whatsapp_web',
    transport: 'baileys',
    provider_message_id: String(payload.messageId),
    external_thread_id: phone,
    external_user_id: phone,
    direction: payload.fromMe ? 'outbound' : 'inbound',
    sender_type: payload.fromMe ? 'human' : 'customer',
    text: payload.text ?? null,
    message_type: 'text',
    sent_at: new Date(payload.timestamp).toISOString(),
    raw_payload: payload,
    display_name: payload.pushName ?? null,
  };
}
