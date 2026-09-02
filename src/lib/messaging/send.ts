import { sendWhatsAppCloud } from './transports/whatsapp-cloud';
import { sendInstagramMeta } from './transports/instagram-meta';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { recordWhatsAppUsage } from '@/lib/observability/usage';

type SendInput = {
  channel: 'whatsapp' | 'instagram';
  customerId?: string;
  conversationId: string;
  to: string;
  text: string;
  mode?: 'manual' | 'automatic';
  automationAuthorized?: boolean;
  agent?: string;
};

export async function sendMessage(input: SendInput) {
  const manual = input.mode === 'manual';
  const automatic = input.mode === 'automatic' && input.automationAuthorized === true;
  const db = createSupabaseServiceClient();
  const { data: conversation, error: conversationError } = await db.from('conversations')
    .select('business_unit_id,channel').eq('id', input.conversationId).maybeSingle();
  if (conversationError) throw conversationError;
  if (!conversation?.business_unit_id || conversation.channel !== input.channel) {
    throw new Error('conversation_tenant_or_channel_mismatch');
  }
  const tenantContext = { businessUnitId: String(conversation.business_unit_id) };
  if (input.channel === 'whatsapp') {
    const started = Date.now();
    const result = await sendWhatsAppCloud(
      { to: input.to, text: input.text },
      { manual, automatic, ...tenantContext },
    );
    await recordWhatsAppUsage(db, {
      businessUnitId: conversation.business_unit_id,
      conversationId: input.conversationId,
      agent: input.agent || (manual ? 'human' : 'system'),
      providerMessageId: result.providerMessageId,
      latencyMs: Date.now() - started,
      messageType: 'text',
      metadata: { mode: input.mode || 'system', billing_note: 'text/service-window send; final Meta invoice category not inferred here' },
    });
    return result;
  }
  if (input.channel === 'instagram') return sendInstagramMeta(
    { to: input.to, text: input.text },
    { manual, automatic, ...tenantContext },
  );
  throw new Error('unsupported_channel');
}
