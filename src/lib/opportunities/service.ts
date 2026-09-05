import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { detectOpportunity } from './detector';
import { buildOpportunityMessage } from './message';
import { evaluateOpportunityPolicy } from './policy';
import type { OpportunityChannel, OpportunityRow } from './types';

const PRICE_RE = /(?:cu[aá]nto|precio|valor|sale|cuesta|\$)/i;
const SHIPPING_RE = /(?:env[ií]o|despacho|comuna|entrega|retiro|delivery)/i;
const PRODUCT_RE = /(?:pack|empanad|parriller|kostill|seit[aá]n|choripan|vurger|barra|chocolate|bomb[oó]n|trufa|brigadeiro|alfajor|torta|box|postre|dulce)/i;
const OPTOUT_RE = /(?:no\s+me\s+(?:escrib|contact)|deja\s+de\s+escrib|no\s+quiero\s+mensajes|b[oó]rrame|stop)/i;
const REJECT_RE = /(?:no\s+gracias|ya\s+no\s+(?:quiero|me\s+interesa)|no\s+me\s+interesa)/i;

function asArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function messageAt(row: any): string | null {
  return row?.sent_at || row?.created_at || null;
}

function extractReferral(messages: any[]) {
  for (const row of [...messages].reverse()) {
    const payload = row?.payload || {};
    const referral = payload?.referral || payload?.event?.referral || payload?.event?.message?.referral || payload?.raw_payload?.referral;
    if (!referral || typeof referral !== 'object') continue;
    const source = String(referral.source || referral.ref || referral.type || '').toLowerCase();
    const adId = referral.ad_id || referral.adId || referral.ads_context_data?.ad_id || null;
    const campaign = referral.campaign_id || referral.campaignId || null;
    return {
      adSource: Boolean(adId || campaign || source.includes('ad')),
      sourceAd: adId ? String(adId) : null,
      sourceCampaign: campaign ? String(campaign) : null,
    };
  }
  return { adSource: false, sourceAd: null, sourceCampaign: null };
}

function paidOrder(row: any) {
  const payment = String(row?.payment_status || '').toLowerCase();
  const state = String(row?.estado || '').toLowerCase();
  return payment === 'paid' || /pagad|complet|entreg/.test(state);
}

async function getLinkedOrder(db: SupabaseClient, orderId?: number | null) {
  if (!orderId) return null;
  const { data, error } = await db.from('pedidos')
    .select('id,total,payment_status,estado,created_at')
    .eq('id', orderId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function closeConversationOpportunities(
  db: SupabaseClient,
  conversationId: string,
  reason: string,
  convertedOrder?: { id: number; total: number } | null,
) {
  const patch: Record<string, unknown> = convertedOrder
    ? {
        status: 'converted',
        converted_order_id: convertedOrder.id,
        converted_revenue: convertedOrder.total,
        recovered_sale: false,
        next_followup_at: null,
        claim_token: null,
        claim_expires_at: null,
        dismissal_reason: reason,
      }
    : {
        status: 'expired',
        next_followup_at: null,
        claim_token: null,
        claim_expires_at: null,
        dismissal_reason: reason,
      };
  const { error } = await db.from('sales_opportunities')
    .update(patch)
    .eq('conversation_id', conversationId)
    .in('status', ['open', 'snoozed']);
  if (error) throw error;
}

export async function evaluateConversationOpportunity(
  db: SupabaseClient,
  conversationId: string,
): Promise<OpportunityRow | null> {
  const { data: conversation, error: conversationError } = await db.from('conversations')
    .select('id,business_unit_id,customer_id,channel,order_id,human_takeover,labels,metadata,ai_enabled,last_message_at')
    .eq('id', conversationId)
    .maybeSingle();
  if (conversationError) throw conversationError;
  if (!conversation || !['instagram', 'whatsapp'].includes(String(conversation.channel))) return null;

  const [{ data: messages, error: messagesError }, { data: cart, error: cartError }, { data: contact, error: contactError }] = await Promise.all([
    db.from('omnichannel_messages')
      .select('id,direction,body,payload,sent_at,created_at,message_type')
      .eq('conversation_id', conversationId)
      .not('message_type', 'like', 'status:%')
      .order('created_at', { ascending: false })
      .limit(40),
    db.from('carritos_abandonados')
      .select('id,items,subtotal,order_id,recuperado,last_activity_at')
      .eq('conversation_id', conversationId)
      .eq('recuperado', false)
      .order('last_activity_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    conversation.customer_id
      ? db.from('omnichannel_contacts').select('id,nombre,display_name,metadata').eq('id', conversation.customer_id).maybeSingle()
      : Promise.resolve({ data: null, error: null } as any),
  ]);
  if (messagesError) throw messagesError;
  if (cartError) throw cartError;
  if (contactError) throw contactError;

  const rows = asArray(messages).slice().reverse();
  const inbound = rows.filter((row) => row.direction === 'inbound');
  const outbound = rows.filter((row) => row.direction === 'outbound');
  const lastInbound = inbound.at(-1) || null;
  const lastOutbound = outbound.at(-1) || null;
  const lastCustomerMessageAt = messageAt(lastInbound);
  const lastBusinessMessageAt = messageAt(lastOutbound);
  const customerText = inbound.map((row) => String(row.body || '')).join('\n');
  const allText = rows.map((row) => String(row.body || '')).join('\n');
  const labels = Array.isArray(conversation.labels) ? conversation.labels.map(String) : [];
  const personal = Boolean(conversation.metadata?.personal || labels.includes('personal') || contact?.metadata?.personal);

  const order = await getLinkedOrder(db, Number(conversation.order_id || cart?.order_id || 0) || null);
  const hasPaidOrder = paidOrder(order);
  const hasUnpaidOrder = Boolean(order && !hasPaidOrder);
  const cartItems = asArray(cart?.items);
  const hasCart = Boolean(cart && cartItems.length > 0 && Number(cart.subtotal || 0) >= 0);
  const referral = extractReferral(rows);
  const productName = cartItems[0]?.nombre ? String(cartItems[0].nombre) : null;

  // A generic conversation is only recoverable once we have replied and the
  // customer has not responded afterwards. A real cart/order may still be a
  // recovery candidate even without a recorded outbound.
  const customerRepliedAfterUs = Boolean(lastCustomerMessageAt && lastBusinessMessageAt && new Date(lastCustomerMessageAt) > new Date(lastBusinessMessageAt));
  if (customerRepliedAfterUs && !hasCart && !hasUnpaidOrder) {
    await closeConversationOpportunities(db, conversationId, 'customer_replied');
    return null;
  }

  const decision = detectOpportunity({
    channel: conversation.channel as OpportunityChannel,
    hasUnpaidOrder,
    hasPaidOrder,
    hasCart,
    cartSubtotal: Number(cart?.subtotal || 0),
    askedPrice: PRICE_RE.test(customerText),
    askedShipping: SHIPPING_RE.test(customerText),
    productMentioned: Boolean(productName || PRODUCT_RE.test(allText)),
    optedOut: OPTOUT_RE.test(customerText),
    rejected: REJECT_RE.test(customerText),
    humanTakeover: Boolean(conversation.human_takeover),
    personal,
    adSource: referral.adSource,
    lastBusinessMessageAt,
    lastCustomerMessageAt,
  });

  if (!decision) {
    await closeConversationOpportunities(db, conversationId, hasPaidOrder ? 'paid_order' : 'not_recoverable');
    return null;
  }

  const firstName = String(contact?.nombre || contact?.display_name || '').trim().split(/\s+/)[0] || null;
  const recommendedMessage = buildOpportunityMessage({ firstName, productName, stage: decision.stage });
  const timing = evaluateOpportunityPolicy({
    channel: conversation.channel as OpportunityChannel,
    aiEnabled: false,
    sendMode: 'disabled',
    channelEnabled: true,
    conversationEnabled: Boolean(conversation.ai_enabled),
    humanTakeover: Boolean(conversation.human_takeover),
    personal,
    paidOrder: hasPaidOrder,
    dismissed: false,
    optedOut: OPTOUT_RE.test(customerText),
    followupCount: 0,
    lastBusinessMessageAt: lastBusinessMessageAt || cart?.last_activity_at || conversation.last_message_at,
  });

  const productContext = {
    productName,
    cartSubtotal: hasCart ? Number(cart?.subtotal || 0) : null,
    cartItems: cartItems.slice(0, 12).map((item: any) => ({ name: item?.nombre || null, qty: item?.qty || null })),
    linkedOrderId: order?.id || null,
  };

  const { data: existing, error: existingError } = await db.from('sales_opportunities')
    .select('*')
    .eq('business_unit_id', conversation.business_unit_id)
    .eq('conversation_id', conversationId)
    .eq('stage', decision.stage)
    .in('status', ['open', 'snoozed'])
    .limit(1)
    .maybeSingle();
  if (existingError) throw existingError;

  const payload = {
    business_unit_id: conversation.business_unit_id,
    conversation_id: conversationId,
    customer_id: conversation.customer_id,
    channel: conversation.channel,
    priority: decision.priority,
    stage: decision.stage,
    score: decision.score,
    reason_code: decision.reasonCode,
    reason_summary: decision.reasonSummary,
    source_type: decision.sourceType,
    source_campaign: referral.sourceCampaign,
    source_ad: referral.sourceAd,
    product_context: productContext,
    last_customer_message_at: lastCustomerMessageAt,
    last_business_message_at: lastBusinessMessageAt,
    last_activity_at: conversation.last_message_at || lastBusinessMessageAt || lastCustomerMessageAt || new Date().toISOString(),
    recommended_at: new Date().toISOString(),
    recommended_channel: conversation.channel,
    recommended_message: recommendedMessage,
    next_followup_at: timing.nextFollowupAt,
    last_error: null,
  };

  if (existing?.id) {
    const { data, error } = await db.from('sales_opportunities').update(payload).eq('id', existing.id).select('*').single();
    if (error) throw error;
    return data as OpportunityRow;
  }

  const { data, error } = await db.from('sales_opportunities').insert({ ...payload, status: 'open' }).select('*').single();
  if (error) {
    if ((error as any).code === '23505') {
      const retry = await db.from('sales_opportunities')
        .select('*')
        .eq('business_unit_id', conversation.business_unit_id)
        .eq('conversation_id', conversationId)
        .eq('stage', decision.stage)
        .in('status', ['open', 'snoozed'])
        .limit(1)
        .maybeSingle();
      if (retry.error) throw retry.error;
      return retry.data as OpportunityRow | null;
    }
    throw error;
  }
  return data as OpportunityRow;
}

export async function listSalesOpportunities(
  db: SupabaseClient,
  filters: { status?: string; priority?: string; channel?: string } = {},
) {
  let query = db.from('sales_opportunities').select('*').order('score', { ascending: false }).order('last_activity_at', { ascending: false });
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.priority) query = query.eq('priority', filters.priority);
  if (filters.channel) query = query.eq('channel', filters.channel);
  const { data, error } = await query.limit(200);
  if (error) throw error;
  return (data || []) as OpportunityRow[];
}
