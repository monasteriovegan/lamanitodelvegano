import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export type OpportunityOrderAttributionInput = {
  orderId: number;
  conversationId?: string | null;
  customerId?: string | null;
  total: number;
  createdAt: string;
};

export async function attributeOrderToOpportunity(
  db: SupabaseClient,
  input: OpportunityOrderAttributionInput,
): Promise<void> {
  if (!input.conversationId && !input.customerId) return;
  let query = db.from('sales_opportunities')
    .select('id,last_followup_at,last_provider_message_id,followup_count,created_at,last_activity_at,score')
    .in('status', ['open', 'snoozed'])
    .lte('created_at', input.createdAt)
    .order('score', { ascending: false })
    .order('last_activity_at', { ascending: false })
    .limit(1);

  if (input.conversationId) query = query.eq('conversation_id', input.conversationId);
  else if (input.customerId) query = query.eq('customer_id', input.customerId);

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) return;

  const hadSuccessfulFollowup = Boolean(
    data.last_followup_at ||
    data.last_provider_message_id ||
    Number(data.followup_count || 0) > 0
  );

  const { error: updateError } = await db.from('sales_opportunities')
    .update({
      status: 'converted',
      converted_order_id: input.orderId,
      converted_revenue: Number(input.total || 0),
      recovered_sale: hadSuccessfulFollowup,
      next_followup_at: null,
      claim_token: null,
      claim_expires_at: null,
      last_error: null,
    })
    .eq('id', data.id)
    .in('status', ['open', 'snoozed']);
  if (updateError) throw updateError;

  // Other simultaneous stages for the same conversation must stop immediately,
  // but they are not credited as recovered revenue to avoid double attribution.
  if (input.conversationId) {
    const { error: siblingsError } = await db.from('sales_opportunities')
      .update({ status: 'expired', next_followup_at: null, dismissal_reason: 'converted_other_stage', claim_token: null, claim_expires_at: null })
      .eq('conversation_id', input.conversationId)
      .neq('id', data.id)
      .in('status', ['open', 'snoozed']);
    if (siblingsError) throw siblingsError;
  }
}
