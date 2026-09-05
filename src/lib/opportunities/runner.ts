import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sendMessage } from '@/lib/messaging/send';
import { persistMessage } from '@/lib/messaging/messages';
import { evaluateOpportunityPolicy } from './policy';
import { buildOpportunityMessage } from './message';
import { evaluateConversationOpportunity } from './service';
import type { OpportunityRow } from './types';

const LOOKBACK_DAYS = 14;
const CLAIM_MINUTES = 5;

function envEnabled(name: string) {
  return String(process.env[name] || '').toLowerCase() === 'true';
}

function channelSendMode(settings: any): 'disabled' | 'read_only' | 'live' {
  if (!settings?.enabled) return 'disabled';
  if (settings?.read_only_mode) return 'read_only';
  return settings?.auto_reply_enabled ? 'live' : 'disabled';
}

async function claimOpportunity(db: SupabaseClient, opportunity: OpportunityRow, now: Date) {
  const claimToken = crypto.randomUUID();
  const claimExpiresAt = new Date(now.getTime() + CLAIM_MINUTES * 60_000).toISOString();
  const { data, error } = await db.from('sales_opportunities')
    .update({ claim_token: claimToken, claim_expires_at: claimExpiresAt })
    .eq('id', opportunity.id)
    .eq('status', 'open')
    .eq('followup_count', opportunity.followup_count)
    .or(`claim_expires_at.is.null,claim_expires_at.lt.${now.toISOString()}`)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  return data ? claimToken : null;
}

async function releaseClaim(db: SupabaseClient, id: string, claimToken: string, lastError?: string | null) {
  await db.from('sales_opportunities')
    .update({ claim_token: null, claim_expires_at: null, last_error: lastError || null })
    .eq('id', id)
    .eq('claim_token', claimToken);
}

async function markProviderSend(
  db: SupabaseClient,
  opportunity: OpportunityRow,
  claimToken: string,
  providerMessageId: string | null,
  now: Date,
  persistError?: string | null,
) {
  const nextCount = Math.min(2, Number(opportunity.followup_count || 0) + 1);
  const secondAt = nextCount < 2 ? new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString() : null;
  const { error } = await db.from('sales_opportunities')
    .update({
      followup_count: nextCount,
      last_followup_at: now.toISOString(),
      next_followup_at: secondAt,
      status: nextCount >= 2 ? 'expired' : 'open',
      last_provider_message_id: providerMessageId,
      claim_token: null,
      claim_expires_at: null,
      last_error: persistError || null,
    })
    .eq('id', opportunity.id)
    .eq('claim_token', claimToken);
  if (error) throw error;
}

export async function runOpportunityCycle(
  db: SupabaseClient,
  now = new Date(),
): Promise<{ evaluated: number; recommended: number; sent: number; blocked: number }> {
  let evaluated = 0;
  let recommended = 0;
  let sent = 0;
  let blocked = 0;

  const lookback = new Date(now.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: conversations, error: conversationError } = await db.from('conversations')
    .select('id')
    .in('channel', ['instagram', 'whatsapp'])
    .gte('last_message_at', lookback)
    .order('last_message_at', { ascending: false })
    .limit(200);
  if (conversationError) throw conversationError;

  for (const conversation of conversations || []) {
    try {
      await evaluateConversationOpportunity(db, String(conversation.id));
      evaluated += 1;
    } catch (error) {
      console.error('opportunity_cycle_evaluation_failed', {
        conversationId: conversation.id,
        reason: error instanceof Error ? error.message : 'unknown',
      });
    }
  }

  const { data: due, error: dueError } = await db.from('sales_opportunities')
    .select('*')
    .eq('status', 'open')
    .not('next_followup_at', 'is', null)
    .lte('next_followup_at', now.toISOString())
    .order('score', { ascending: false })
    .limit(50);
  if (dueError) throw dueError;

  const { data: globalConfig, error: globalError } = await db.from('integraciones_secretas')
    .select('ai_enabled')
    .eq('id', 'global')
    .maybeSingle();
  if (globalError) throw globalError;

  // Observation/copilot is the production default. Turning Remy on globally
  // is not sufficient to enable proactive follow-ups: this separate switch is
  // required after reviewing recommendation quality.
  const automaticExecutionEnabled = envEnabled('SALES_OPPORTUNITY_AUTO_SEND');
  const cartCutover = envEnabled('SALES_OPPORTUNITY_CART_CUTOVER');

  for (const raw of due || []) {
    const opportunity = raw as OpportunityRow;
    recommended += 1;

    // Until cart recovery is explicitly cut over, legacy abandoned-cart logic
    // remains the only automatic owner for that stage.
    if (opportunity.stage === 'cart_abandoned' && !cartCutover) {
      blocked += 1;
      continue;
    }

    const [{ data: conversation, error: convError }, { data: settings, error: settingsError }] = await Promise.all([
      db.from('conversations')
        .select('id,channel,external_conversation_id,customer_id,ai_enabled,human_takeover,labels,metadata,order_id')
        .eq('id', opportunity.conversation_id)
        .maybeSingle(),
      db.from('channel_settings')
        .select('enabled,auto_reply_enabled,read_only_mode')
        .eq('business_unit_id', opportunity.business_unit_id)
        .eq('channel', opportunity.channel)
        .maybeSingle(),
    ]);
    if (convError) throw convError;
    if (settingsError) throw settingsError;
    if (!conversation) {
      blocked += 1;
      continue;
    }

    let paidOrder = false;
    if (conversation.order_id) {
      const { data: order, error: orderError } = await db.from('pedidos')
        .select('payment_status,estado')
        .eq('id', conversation.order_id)
        .maybeSingle();
      if (orderError) throw orderError;
      paidOrder = String(order?.payment_status || '').toLowerCase() === 'paid' || /pagad|complet|entreg/i.test(String(order?.estado || ''));
    }

    const labels = Array.isArray(conversation.labels) ? conversation.labels.map(String) : [];
    const personal = Boolean(conversation.metadata?.personal || labels.includes('personal'));
    const sendMode = channelSendMode(settings);
    const policy = evaluateOpportunityPolicy({
      channel: opportunity.channel,
      aiEnabled: Boolean(globalConfig?.ai_enabled),
      sendMode,
      channelEnabled: Boolean(settings?.enabled && settings?.auto_reply_enabled),
      conversationEnabled: Boolean(conversation.ai_enabled),
      humanTakeover: Boolean(conversation.human_takeover),
      personal,
      paidOrder,
      dismissed: opportunity.status === 'dismissed',
      optedOut: false,
      followupCount: opportunity.followup_count,
      lastBusinessMessageAt: opportunity.last_business_message_at,
      lastFollowupAt: opportunity.last_followup_at,
      now: now.toISOString(),
    });

    if (!automaticExecutionEnabled || !policy.automaticSend) {
      blocked += 1;
      continue;
    }

    const claimToken = await claimOpportunity(db, opportunity, now);
    if (!claimToken) {
      blocked += 1;
      continue;
    }

    const productName = typeof opportunity.product_context?.productName === 'string'
      ? opportunity.product_context.productName
      : null;
    const text = opportunity.recommended_message || buildOpportunityMessage({
      productName,
      stage: opportunity.stage,
    });

    try {
      const result = await sendMessage({
        channel: opportunity.channel as 'whatsapp' | 'instagram',
        conversationId: opportunity.conversation_id,
        customerId: opportunity.customer_id || undefined,
        to: String(conversation.external_conversation_id || ''),
        text,
        mode: 'automatic',
        automationAuthorized: true,
        agent: 'remy',
      });
      const providerMessageId = String((result as any)?.providerMessageId || '');

      try {
        await persistMessage(db, {
          channel: opportunity.channel as 'whatsapp' | 'instagram',
          provider: 'meta',
          transport: opportunity.channel === 'whatsapp' ? 'cloud_api' : 'instagram_api',
          provider_message_id: providerMessageId || `opportunity:${opportunity.id}:${now.getTime()}`,
          external_thread_id: String(conversation.external_conversation_id || ''),
          external_user_id: String(conversation.external_conversation_id || ''),
          direction: 'outbound',
          sender_type: 'remy',
          text,
          message_type: 'text',
          sent_at: now.toISOString(),
          raw_payload: {
            source: 'sales_opportunity',
            opportunity_id: opportunity.id,
            reason_code: opportunity.reason_code,
            provider_message_id: providerMessageId || null,
          },
        });
        await markProviderSend(db, opportunity, claimToken, providerMessageId || null, now);
      } catch (persistError) {
        // Provider already accepted the send. Count it before surfacing the
        // persistence problem so a retry cannot message the customer twice.
        await markProviderSend(
          db,
          opportunity,
          claimToken,
          providerMessageId || null,
          now,
          `persist_failed_after_send:${persistError instanceof Error ? persistError.message : 'unknown'}`,
        );
        console.error('opportunity_message_persist_failed_after_send', {
          opportunityId: opportunity.id,
          providerMessageId: providerMessageId || null,
        });
      }
      sent += 1;
    } catch (error) {
      await releaseClaim(db, opportunity.id, claimToken, error instanceof Error ? error.message : 'send_failed');
      blocked += 1;
      console.error('opportunity_auto_send_failed', {
        opportunityId: opportunity.id,
        reason: error instanceof Error ? error.message : 'unknown',
      });
    }
  }

  return { evaluated, recommended, sent, blocked };
}
