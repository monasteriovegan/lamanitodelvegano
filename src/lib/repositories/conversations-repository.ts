import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSchemaCapabilities, type SchemaCapabilities } from './schema-capabilities';

type JsonRecord = Record<string, any>;

export type AdminConversation = {
  id: string;
  contact: string | null;
  customer_id: string | null;
  channel: string;
  status: string;
  mode: 'human' | 'automatic';
  last_message: string | null;
  last_message_at: string | null;
  assigned_to: string | null;
  order_id: number | null;
  metadata: JsonRecord;
  external_thread_id: string;
};

export function mapConversation(row: JsonRecord): AdminConversation {
  return {
    id: String(row.id),
    contact: row.customer_id ?? row.contact_id ?? null,
    customer_id: row.customer_id ?? null,
    channel: String(row.channel),
    status: String(row.status ?? row.automation_status ?? 'open'),
    mode: row.human_takeover ? 'human' : 'automatic',
    last_message: row.metadata?.last_message ?? null,
    last_message_at: row.last_message_at ?? null,
    assigned_to: row.assigned_user_id ?? null,
    order_id: row.order_id == null ? null : Number(row.order_id),
    metadata: row.metadata ?? {},
    external_thread_id: String(row.external_conversation_id),
  };
}

export class ConversationRepository {
  private readonly capabilities: SchemaCapabilities;

  constructor(
    private readonly db: SupabaseClient,
    capabilities: SchemaCapabilities = getSchemaCapabilities(),
  ) {
    this.capabilities = capabilities;
  }

  async getById(id: string): Promise<AdminConversation | null> {
    const { data, error } = await this.db.from('conversations').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? mapConversation(data) : null;
  }

  async findByChannel(id: string, channel: string): Promise<AdminConversation | null> {
    const { data, error } = await this.db
      .from('conversations')
      .select('*')
      .eq('id', id)
      .eq('channel', channel)
      .maybeSingle();
    if (error) throw error;
    return data ? mapConversation(data) : null;
  }

  async upsert(input: {
    businessUnitId: string;
    customerId: string | null;
    channel: string;
    externalThreadId: string;
    displayName?: string | null;
    lastMessageAt: string;
    provider: string;
    transport: string;
  }): Promise<AdminConversation> {
    const payload: JsonRecord = {
      business_unit_id: input.businessUnitId,
      channel: input.channel,
      external_conversation_id: input.externalThreadId,
      contact_id: input.customerId,
      last_message_at: input.lastMessageAt,
      updated_at: new Date().toISOString(),
    };
    if (this.capabilities.messagingExtensions) {
      payload.customer_id = input.customerId;
      payload.provider = input.provider;
      payload.transport = input.transport;
      payload.status = 'open';
      payload.metadata = { external_username: input.displayName ?? null };
    }
    const { data, error } = await this.db
      .from('conversations')
      .upsert(payload, { onConflict: 'business_unit_id,channel,external_conversation_id' })
      .select('*')
      .single();
    if (error) throw error;
    return mapConversation(data);
  }
}

