import type { SupabaseClient } from '@supabase/supabase-js';
import { BusinessRepository } from '@/lib/repositories/business-repository';
import { ConversationRepository } from '@/lib/repositories/conversations-repository';
import { MessageRepository } from '@/lib/repositories/messages-repository';
import { getSchemaCapabilities } from '@/lib/repositories/schema-capabilities';
import { resolveCustomer } from './identity';
import type { NormalizedMessage, PersistedMessage } from './types';

export async function persistMessage(
  db: SupabaseClient,
  message: NormalizedMessage,
): Promise<PersistedMessage> {
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
  const isStatus = message.message_type.startsWith('status:');
  const customerId = isStatus
    ? null
    : await resolveCustomer(db, business.id, {
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
    if (!isStatus && getSchemaCapabilities().supportTables) {
      const now = new Date().toISOString();
      await db.from('messaging_transport_status').upsert({
        transport: message.transport,
        status: 'healthy',
        last_inbound_at: message.direction === 'inbound' ? now : undefined,
        last_outbound_at: message.direction === 'outbound' ? now : undefined,
        updated_at: now,
      });
    }
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
