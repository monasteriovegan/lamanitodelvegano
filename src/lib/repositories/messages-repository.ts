import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { NormalizedMessage } from '@/lib/messaging/types';
import { getSchemaCapabilities, type SchemaCapabilities } from './schema-capabilities';

type JsonRecord = Record<string, any>;

export type StoredMessage = {
  id: string;
  conversation_id: string;
  provider: string | null;
  transport: string | null;
  provider_message_id: string;
  direction: string;
  status: string;
  body: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  metadata: JsonRecord;
};

export function mapMessage(row: JsonRecord): StoredMessage {
  const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
  return {
    id: String(row.id),
    conversation_id: String(row.conversation_id),
    provider: row.provider ?? payload.provider ?? null,
    transport: row.transport ?? payload.transport ?? null,
    provider_message_id: String(row.provider_message_id ?? row.external_message_id),
    direction: String(row.direction),
    status: String(row.status ?? 'received'),
    body: row.body ?? null,
    sent_at: row.sent_at ?? row.created_at ?? null,
    delivered_at: row.delivered_at ?? null,
    read_at: row.read_at ?? null,
    metadata: payload,
  };
}

export class MessageRepository {
  private readonly capabilities: SchemaCapabilities;

  constructor(
    private readonly db: SupabaseClient,
    capabilities: SchemaCapabilities = getSchemaCapabilities(),
  ) {
    this.capabilities = capabilities;
  }

  async findDuplicate(message: NormalizedMessage): Promise<StoredMessage | null> {
    let query = this.db.from('omnichannel_messages').select('*');
    if (this.capabilities.messagingExtensions) {
      query = query
        .eq('provider', message.provider)
        .eq('transport', message.transport)
        .eq('provider_message_id', message.provider_message_id);
    } else {
      query = query.eq('external_message_id', message.provider_message_id);
    }
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data ? mapMessage(data) : null;
  }

  async create(conversationId: string, customerId: string | null, message: NormalizedMessage): Promise<StoredMessage> {
    const payload: JsonRecord = {
      conversation_id: conversationId,
      external_message_id: message.provider_message_id,
      direction: message.direction,
      message_type: message.message_type,
      body: message.text,
      payload: {
        provider: message.provider,
        transport: message.transport,
        external_thread_id: message.external_thread_id,
        sender_type: message.sender_type,
        raw: message.raw_payload,
      },
      status: message.message_type.startsWith('status:') ? message.message_type.slice(7) : 'received',
    };
    if (this.capabilities.messagingExtensions) {
      payload.provider = message.provider;
      payload.transport = message.transport;
      payload.provider_message_id = message.provider_message_id;
      payload.customer_id = customerId;
      payload.sent_at = message.sent_at;
    }
    const { data, error } = await this.db
      .from('omnichannel_messages')
      .insert(payload)
      .select('*')
      .single();
    if (error) throw error;
    return mapMessage(data);
  }
}

