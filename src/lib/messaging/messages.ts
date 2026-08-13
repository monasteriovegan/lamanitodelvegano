import type { SupabaseClient } from '@supabase/supabase-js';
import { BusinessRepository } from '@/lib/repositories/business-repository';
import { ConversationRepository } from '@/lib/repositories/conversations-repository';
import { MessageRepository } from '@/lib/repositories/messages-repository';
import { resolveCustomer } from './identity';
import type { NormalizedMessage, PersistedMessage } from './types';

async function updateTransportHealth(db: SupabaseClient, message: NormalizedMessage, failed = false) {
  const now = new Date().toISOString();
  await db.from('messaging_transport_status').upsert({
    transport: message.transport,
    status: failed ? 'error' : 'healthy',
    last_inbound_at: message.direction === 'inbound' ? now : undefined,
    last_outbound_at: message.direction === 'outbound' ? now : undefined,
    last_error: failed ? 'provider_status_failed' : null,
    updated_at: now,
  });
}

async function applyProviderStatus(
  db: SupabaseClient,
  message: NormalizedMessage,
): Promise<PersistedMessage | null> {
  if (!message.message_type.startsWith('status:')) return null;

  const raw = message.raw_payload as any;
  const providerId = String(raw?.status?.id || '');
  if (!providerId) return null;

  let { data: target, error } = await db
    .from('omnichannel_messages')
    .select('id,conversation_id,customer_id')
    .eq('provider_message_id', providerId)
    .maybeSingle();

  if (error) throw error;
  if (!target) {
    const fallback = await db
      .from('omnichannel_messages')
      .select('id,conversation_id,customer_id')
      .eq('external_message_id', providerId)
      .maybeSingle();
    if (fallback.error) throw fallback.error;
    target = fallback.data;
  }

  if (!target) return null;

  const status = message.message_type.slice(7);
  const patch: Record<string, any> = {
    status,
    provider: message.provider,
    transport: message.transport,
    provider_message_id: providerId,
  };

  if (status === 'sent') patch.sent_at = message.sent_at;
  if (status === 'delivered') patch.delivered_at = message.sent_at;
  if (status === 'read') patch.read_at = message.sent_at;

  const { error: updateError } = await db
    .from('omnichannel_messages')
    .update(patch)
    .eq('id', target.id);
  if (updateError) throw updateError;

  await updateTransportHealth(db, message, status === 'failed');

  return {
    duplicate: false,
    conversationId: String(target.conversation_id),
    customerId: target.customer_id ?? null,
    messageId: String(target.id),
  };
}

export async function persistMessage(
  db: SupabaseClient,
  message: NormalizedMessage,
): Promise<PersistedMessage> {
  const statusResult = await applyProviderStatus(db, message);
  if (statusResult) return statusResult;

  const messages = new MessageRepository(db);
  const existing = await messages.findDuplicate(message);
  if (existing) {
    return {
      duplicate: true,
      conversationId: existing.conversation_id,
      customerId: null,
      messageId: existing.id,
    };
  }

  const business = await new BusinessRepository(db).requireDefault();
  const customerId = await resolveCustomer(db, business.id, {
    channel: message.channel,
    externalId: message.external_user_id,
    phone: message.channel === 'whatsapp' ? message.external_user_id : undefined,
    name: message.display_name,
  });

  const conversation = await new ConversationRepository(db).upsert({
    businessUnitId: business.id,
    customerId,
    channel: message.channel,
    externalThreadId: message.external_thread_id,
    displayName: message.display_name,
    lastMessageAt: message.sent_at,
    provider: message.provider,
    transport: message.transport,
  });

  try {
    const created = await messages.create(conversation.id, customerId, message);
    await updateTransportHealth(db, message);
    return {
      duplicate: false,
      conversationId: conversation.id,
      customerId,
      messageId: created.id,
    };
  } catch (error: any) {
    if (error?.code === '23505') {
      return {
        duplicate: true,
        conversationId: conversation.id,
        customerId,
        messageId: null,
      };
    }
    throw error;
  }
}
