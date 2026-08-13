export type Channel = 'whatsapp' | 'instagram' | 'messenger' | 'web' | 'manual';

export type NormalizedMessage = {
  channel: Channel;
  provider: 'meta' | 'whatsapp_web' | 'web' | 'manual';
  transport: 'cloud_api' | 'instagram_api' | 'baileys' | 'web' | 'manual';
  provider_message_id: string;
  external_thread_id: string;
  external_user_id: string;
  direction: 'inbound' | 'outbound';
  sender_type: 'customer' | 'human' | 'remy' | 'system';
  text: string | null;
  message_type: string;
  sent_at: string;
  raw_payload: unknown;
  display_name?: string | null;
};

export type PersistedMessage = {
  duplicate: boolean;
  conversationId: string;
  customerId: string | null;
  messageId: string | null;
};
