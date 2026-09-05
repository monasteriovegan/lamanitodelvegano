import type { SupabaseClient } from '@supabase/supabase-js';
import { BusinessRepository } from '@/lib/repositories/business-repository';
import { MetaConnectionsRepository } from '@/lib/repositories/meta-connections-repository';
import { ConversationRepository } from '@/lib/repositories/conversations-repository';
import { MessageRepository } from '@/lib/repositories/messages-repository';
import { evaluateConversationOpportunity } from '@/lib/opportunities/service';
import { resolveCustomer } from './identity';
import { processInboundImageOcrAsync } from './ocr';
import type { NormalizedMessage, PersistedMessage } from './types';

export async function resolveBusinessUnitForMessage(
  db: SupabaseClient,
  message: NormalizedMessage,
): Promise<string> {
  if (message.provider === 'meta') {
    const businessUnitId = await new MetaConnectionsRepository(db).resolveBusinessUnitForMessage(message);
    if (!businessUnitId) throw new Error('meta_asset_not_connected');
    return businessUnitId;
  }

  const business = await new BusinessRepository(db).getDefault();
  if (!business) throw new Error('default_business_not_found');
  return business.id;
}

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

async function recordOrphanWhatsAppOutboundStatus(
  db: SupabaseClient,
  message: NormalizedMessage,
  status: string,
): Promise<PersistedMessage | null> {
  if (message.channel !== 'whatsapp' || !message.external_thread_id) return null;

  let businessUnitId: string;
  try {
    businessUnitId = await resolveBusinessUnitForMessage(db, message);
  } catch {
    return null;
  }

  const { data: conversation, error } = await db
    .from('conversations')
    .select('id,customer_id,contact_id,metadata,last_message_at')
    .eq('business_unit_id', businessUnitId)
    .eq('channel', 'whatsapp')
    .eq('external_conversation_id', message.external_thread_id)
    .maybeSingle();
  if (error) throw error;
  if (!conversation) return null;

  const metadata = conversation.metadata && typeof conversation.metadata === 'object'
    ? conversation.metadata
    : {};
  const external_outbound_at = message.sent_at;
  const external_outbound_status = status;
  const lastAt = conversation.last_message_at ? new Date(conversation.last_message_at).getTime() : 0;
  const statusAt = new Date(message.sent_at).getTime();

  const { error: updateError } = await db
    .from('conversations')
    .update({
      metadata: { ...metadata, external_outbound_at, external_outbound_status },
      ...(Number.isFinite(statusAt) && statusAt > lastAt ? { last_message_at: message.sent_at } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversation.id);
  if (updateError) throw updateError;

  await updateTransportHealth(db, message, status === 'failed');
  return {
    duplicate: true,
    conversationId: String(conversation.id),
    customerId: conversation.customer_id ?? conversation.contact_id ?? null,
    messageId: null,
  };
}

async function applyProviderStatus(
  db: SupabaseClient,
  message: NormalizedMessage,
): Promise<PersistedMessage | null> {
  if (!message.message_type.startsWith('status:')) return null;

  const raw = message.raw_payload as { status?: { id?: unknown } } | null;
  const providerId = String(raw?.status?.id || '');
  if (!providerId) return null;

  const status = message.message_type.slice(7);
  const { data: initialTarget, error } = await db
    .from('omnichannel_messages')
    .select('id,conversation_id,customer_id')
    .eq('provider_message_id', providerId)
    .maybeSingle();

  if (error) throw error;
  let target = initialTarget;
  if (!target) {
    const fallback = await db
      .from('omnichannel_messages')
      .select('id,conversation_id,customer_id')
      .eq('external_message_id', providerId)
      .maybeSingle();
    if (fallback.error) throw fallback.error;
    target = fallback.data;
  }

  if (!target) {
    return recordOrphanWhatsAppOutboundStatus(db, message, status);
  }

  const patch: Record<string, unknown> = {
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

async function findCrossTransportDuplicate(
  db: SupabaseClient,
  conversationId: string,
  message: NormalizedMessage,
): Promise<{ id: string; customer_id: string | null } | null> {
  if (message.channel !== 'whatsapp' || !message.text || !['cloud_api', 'baileys'].includes(message.transport)) {
    return null;
  }

  const at = new Date(message.sent_at).getTime();
  if (!Number.isFinite(at)) return null;
  const lower = new Date(at - 2500).toISOString();
  const upper = new Date(at + 2500).toISOString();

  const { data, error } = await db
    .from('omnichannel_messages')
    .select('id,customer_id,transport')
    .eq('conversation_id', conversationId)
    .eq('direction', message.direction)
    .eq('body', message.text)
    .neq('transport', message.transport)
    .gte('sent_at', lower)
    .lte('sent_at', upper)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? { id: String(data.id), customer_id: data.customer_id ?? null } : null;
}

export async function persistMessage(
  db: SupabaseClient,
  message: NormalizedMessage,
): Promise<PersistedMessage> {
  const statusResult = await applyProviderStatus(db, message);
  if (statusResult) return statusResult;

  if (message.message_type.startsWith('status:')) {
    await updateTransportHealth(db, message);
    return {
      duplicate: true,
      conversationId: '',
      customerId: null,
      messageId: null,
    };
  }

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

  const businessUnitId = await resolveBusinessUnitForMessage(db, message);
  const customerId = await resolveCustomer(db, businessUnitId, {
    channel: message.channel,
    externalId: message.external_user_id,
    phone: message.channel === 'whatsapp' ? message.external_user_id : undefined,
    name: message.display_name,
  });

  const conversation = await new ConversationRepository(db).upsert({
    businessUnitId,
    customerId,
    channel: message.channel,
    externalThreadId: message.external_thread_id,
    displayName: message.display_name,
    lastMessageAt: message.sent_at,
    provider: message.provider,
    transport: message.transport,
  });

  const crossTransportDuplicate = await findCrossTransportDuplicate(db, conversation.id, message);
  if (crossTransportDuplicate) {
    await updateTransportHealth(db, message);
    return {
      duplicate: true,
      conversationId: conversation.id,
      customerId: crossTransportDuplicate.customer_id ?? customerId,
      messageId: crossTransportDuplicate.id,
    };
  }

  try {
    const created = await messages.create(conversation.id, customerId, message);
    await updateTransportHealth(db, message);

    if (message.message_type === 'image' && created?.id) {
      void processInboundImageOcrAsync(db, created.id, message).catch((err) => {
        console.error('image_ocr_background_error', { messageId: created.id, error: err });
      });
    }

    void evaluateConversationOpportunity(db, conversation.id).catch((error) => {
      console.error('opportunity_evaluation_failed', {
        conversationId: conversation.id,
        messageId: created?.id || null,
        reason: error instanceof Error ? error.message : 'unknown',
      });
    });

    return {
      duplicate: false,
      conversationId: conversation.id,
      customerId,
      messageId: created.id,
    };
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
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
