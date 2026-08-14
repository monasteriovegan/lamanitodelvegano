import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export type UsageContext = {
  businessUnitId?: string | null;
  conversationId?: string | null;
  wonkaThreadId?: string | null;
  agent: string;
};

export type GeminiUsage = {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  thoughtsTokenCount?: number;
  cachedContentTokenCount?: number;
  toolUsePromptTokenCount?: number;
  totalTokenCount?: number;
};

async function activePricing(db: SupabaseClient, provider: string, model: string) {
  const { data } = await db
    .from('provider_pricing')
    .select('input_usd_per_million,output_usd_per_million,cached_input_usd_per_million,effective_from,source_url,metadata')
    .eq('provider', provider)
    .eq('model', model)
    .lte('effective_from', new Date().toISOString())
    .or(`effective_to.is.null,effective_to.gt.${new Date().toISOString()}`)
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function recordGeminiUsage(
  db: SupabaseClient,
  input: UsageContext & { model: string; usage?: GeminiUsage | null; latencyMs?: number; status?: string; errorCode?: string; metadata?: Record<string, unknown> },
) {
  const usage = input.usage || {};
  const pricing = await activePricing(db, 'gemini', input.model);
  const inputTokens = Number(usage.promptTokenCount || 0);
  const outputTokens = Number(usage.candidatesTokenCount || 0);
  const thinkingTokens = Number(usage.thoughtsTokenCount || 0);
  const cachedTokens = Number(usage.cachedContentTokenCount || 0);
  const toolTokens = Number(usage.toolUsePromptTokenCount || 0);
  const totalTokens = Number(usage.totalTokenCount || inputTokens + outputTokens + thinkingTokens);
  const inputRate = Number(pricing?.input_usd_per_million || 0);
  const outputRate = Number(pricing?.output_usd_per_million || 0);
  const cachedRate = Number(pricing?.cached_input_usd_per_million || 0);
  const billableInput = Math.max(0, inputTokens - cachedTokens);
  const inputCost = billableInput * inputRate / 1_000_000;
  const cachedCost = cachedTokens * cachedRate / 1_000_000;
  const outputCost = (outputTokens + thinkingTokens) * outputRate / 1_000_000;
  const totalCost = inputCost + cachedCost + outputCost;

  const { error } = await db.from('usage_events').insert({
    business_unit_id: input.businessUnitId || null,
    conversation_id: input.conversationId || null,
    wonka_thread_id: input.wonkaThreadId || null,
    agent: input.agent,
    service: 'llm',
    provider: 'gemini',
    model: input.model,
    operation: 'generate_content',
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    thinking_tokens: thinkingTokens,
    cached_input_tokens: cachedTokens,
    tool_tokens: toolTokens,
    total_tokens: totalTokens,
    input_cost_usd: inputCost,
    output_cost_usd: outputCost,
    cached_cost_usd: cachedCost,
    total_cost_usd: totalCost,
    billing_status: pricing ? 'estimated' : 'unpriced',
    pricing_snapshot: pricing || {},
    latency_ms: input.latencyMs ?? null,
    status: input.status || 'success',
    error_code: input.errorCode || null,
    metadata: input.metadata || {},
  });
  if (error) console.error('usage_event_insert_failed', error.message);
}

export async function recordWhatsAppUsage(
  db: SupabaseClient,
  input: UsageContext & { providerMessageId?: string | null; latencyMs?: number; status?: string; errorCode?: string; messageType?: string; metadata?: Record<string, unknown> },
) {
  const { error } = await db.from('usage_events').insert({
    business_unit_id: input.businessUnitId || null,
    conversation_id: input.conversationId || null,
    agent: input.agent,
    service: 'messaging',
    provider: 'meta',
    model: null,
    operation: 'whatsapp_cloud_send',
    request_count: 1,
    total_cost_usd: 0,
    billing_status: 'observed_unpriced',
    provider_message_id: input.providerMessageId || null,
    latency_ms: input.latencyMs ?? null,
    status: input.status || 'success',
    error_code: input.errorCode || null,
    metadata: { message_type: input.messageType || 'text', ...(input.metadata || {}) },
  });
  if (error && error.code !== '23505') console.error('usage_event_insert_failed', error.message);
}
