import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { compactText } from '@/lib/ai/context-budget';

const HANDOFF_INTENT = /(?:hablar|comunicar|contactar|pasar|derivar).{0,20}(?:humano|persona|asesor|ejecutivo|alguien)|(?:quiero|necesito).{0,15}(?:humano|persona|asesor|ejecutivo)|reclamo|devoluci[oó]n|reembolso|cobro\s+duplicado|pago\s+duplicado|pedido.{0,20}(?:mal|equivocado|incompleto|no\s+lleg)|producto.{0,20}(?:mal|dañado|equivocado)|transferencia|datos\s+bancarios|cuenta\s+bancaria/i;

export function shouldHandoffToHuman(text: string) {
  return HANDOFF_INTENT.test(String(text || ''));
}

export async function getHumanTakeover(db: SupabaseClient, conversationId?: string | null) {
  if (!conversationId) return false;
  const { data, error } = await db.from('conversations')
    .select('human_takeover')
    .eq('id', conversationId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data?.human_takeover);
}

export async function activateHumanHandoff(
  db: SupabaseClient,
  input: { conversationId: string; customerId?: string | null; reasonText: string },
) {
  const now = new Date().toISOString();
  const { data: conversation, error } = await db.from('conversations')
    .select('metadata')
    .eq('id', input.conversationId)
    .maybeSingle();
  if (error) throw error;
  if (!conversation) throw new Error('conversation_not_found');

  const metadata = {
    ...(conversation.metadata && typeof conversation.metadata === 'object' ? conversation.metadata : {}),
    remy_handoff: true,
    remy_handoff_at: now,
    remy_handoff_reason: compactText(input.reasonText, 220),
  };
  const { error: updateError } = await db.from('conversations')
    .update({ human_takeover: true, metadata, updated_at: now })
    .eq('id', input.conversationId);
  if (updateError) throw updateError;

  if (input.customerId) {
    const { data: contact } = await db.from('omnichannel_contacts')
      .select('metadata,crm_status')
      .eq('id', input.customerId)
      .maybeSingle();
    const contactMetadata = {
      ...(contact?.metadata && typeof contact.metadata === 'object' ? contact.metadata : {}),
      needs_human_attention: true,
      needs_human_attention_at: now,
    };
    await db.from('omnichannel_contacts')
      .update({
        metadata: contactMetadata,
        crm_status: contact?.crm_status === 'customer' ? 'customer' : 'needs_attention',
        updated_at: now,
      })
      .eq('id', input.customerId);
  }

  return 'Claro. Dejo esta conversación para atención humana y no seguiré respondiendo automáticamente. Una persona del equipo continuará contigo por aquí.';
}
