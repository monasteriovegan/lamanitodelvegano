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
  if (input.channel === 'whatsapp') {
    const started = Date.now();
    const result = await sendWhatsAppCloud(
      { to: input.to, text: input.text },
      { manual, automatic },
    );
    const db = createSupabaseServiceClient();
    const { data: conversation } = await db.from('conversations').select('business_unit_id').eq('id', input.conversationId).maybeSingle();
    await recordWhatsAppUsage(db, {
      businessUnitId: conversation?.business_unit_id || null,
      conversationId: input.conversationId,
      agent: input.agent || (manual ? 'human' : 'system'),
      providerMessageId: result.providerMessageId,
      latencyMs: Date.now() - started,
      messageType: 'text',
      metadata: { mode: input.mode || 'system', billing_note: 'text/service-window send; final Meta invoice category not inferred here' },
    });
    return result;
  }
  if (input.channel === 'instagram') return sendInstagramMeta({ to: input.to, text: input.text }, { manual, automatic });
  throw new Error('unsupported_channel');
}
