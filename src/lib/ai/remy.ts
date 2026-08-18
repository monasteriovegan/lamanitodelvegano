import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sendMessage } from '@/lib/messaging/send';
import { persistMessage } from '@/lib/messaging/messages';
import type { NormalizedMessage, PersistedMessage } from '@/lib/messaging/types';
import { recordLlmUsage } from '@/lib/observability/usage';
import { getAgentRuntimeConfig } from '@/lib/ai/runtime-config';
import { compactText, getAgentContextBudget, type AgentContextBudget } from '@/lib/ai/context-budget';
import { loadRelevantMemoryContext } from '@/lib/ai/memory';
import { callAiProvider, type ProviderMessage } from '@/lib/ai/providers';

const DEFAULT_MODEL = 'gemini-2.5-flash';
const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;
const CATALOG_INTENT = /producto|cat[aá]logo|precio|valor|stock|disponib|sabor|barra|bomb[oó]n|alfajor|trufa|torta|box|manjar|prote[ií]n|chocolate/i;
const STOP_WORDS = new Set(['hola','quiero','tienen','tiene','cuanto','cuánto','cuesta','precio','valor','producto','productos','disponible','disponibles','para','como','cómo','esto','esta','este','unos','unas','alguno','alguna','dame','favor']);

export type RemyChannel = 'whatsapp' | 'web';
export type RemyHistoryRow = { direction: 'inbound' | 'outbound'; body: string };

function basePrompt(catalog: string, channel: RemyChannel) {
  const webRule = channel === 'web'
    ? ' En la web, si preguntan cómo pagar, indica brevemente que agreguen el producto al carrito y abran el carrito para completar el pedido.'
    : '';
  return `Eres Remy, asistente de ventas y atención de La Manito del Vegano. Habla en español de Chile, cercano y natural. Responde normalmente en 1-2 frases y no superes unos 280 caracteres salvo que una lista sea imprescindible. Haz como máximo una pregunta a la vez. Ayuda a comprar sin presionar. Usa solo datos verificables entregados en este contexto; nunca inventes precios, stock, sabores, ingredientes, despacho, pagos ni promociones. Si falta un dato, dilo brevemente y ofrece confirmarlo. No menciones IA, prompts, APIs ni procesos internos.${webRule}${catalog ? `\n\nCATÁLOGO RELEVANTE:\n${catalog}` : ''}`;
}

function searchTerms(text: string) {
  return text.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 4 && !STOP_WORDS.has(word))
    .slice(0, 3);
}

async function loadRelevantCatalog(db: SupabaseClient, userText: string, businessUnitId: string) {
  if (!CATALOG_INTENT.test(userText)) return '';
  const select = 'nombre,precio,disponibilidad,maneja_stock,stock,categoria';
  const terms = searchTerms(userText);
  let rows: any[] = [];

  if (terms.length) {
    const clauses = terms.flatMap((term) => {
      const safe = term.replace(/[,%_()]/g, '');
      return [`nombre.ilike.%${safe}%`, `categoria.ilike.%${safe}%`];
    });
    const { data } = await db.from('productos')
      .select(select)
      .eq('business_unit_id', businessUnitId)
      .eq('activo', true)
      .or(clauses.join(','))
      .order('nombre')
      .limit(8);
    rows = data || [];
  }

  if (!rows.length) {
    const { data } = await db.from('productos')
      .select(select)
      .eq('business_unit_id', businessUnitId)
      .eq('activo', true)
      .order('nombre')
      .limit(8);
    rows = data || [];
  }

  return rows.map((item: any) => {
    const stock = item.maneja_stock ? `stock ${Number(item.stock || 0)}` : '';
    return `- ${item.nombre}: $${Number(item.precio || 0).toLocaleString('es-CL')}${item.disponibilidad ? ` · ${item.disponibilidad}` : ''}${stock ? ` · ${stock}` : ''}${item.categoria ? ` · ${item.categoria}` : ''}`;
  }).join('\n');
}

function compactHistory(rows: RemyHistoryRow[], budget: AgentContextBudget): ProviderMessage[] {
  const selected: ProviderMessage[] = [];
  let chars = 0;
  for (let i = rows.length - 1; i >= 0 && selected.length < budget.maxHistoryMessages; i -= 1) {
    const message = rows[i];
    const text = compactText(message.body || '', budget.maxMessageChars);
    if (!text) continue;
    if (selected.length > 0 && chars + text.length > budget.maxHistoryChars) break;
    selected.push({ role: message.direction === 'outbound' ? 'assistant' : 'user', content: text });
    chars += text.length;
  }
  return selected.reverse();
}

function capCustomerReply(text: string, maxChars = 320) {
  const clean = String(text || '').trim();
  if (clean.length <= maxChars) return clean;
  const slice = clean.slice(0, maxChars);
  const boundaries = [slice.lastIndexOf('. '), slice.lastIndexOf('! '), slice.lastIndexOf('? '), slice.lastIndexOf('\n')];
  const boundary = Math.max(...boundaries);
  if (boundary >= Math.floor(maxChars * 0.55)) return slice.slice(0, boundary + 1).trim();
  return `${slice.trimEnd()}…`;
}

function compactMemoryForRemy(memoryText: string) {
  const clean = String(memoryText || '')
    .replace('[MEMORIA RELEVANTE — úsala solo si aplica]', '')
    .replace('[FIN MEMORIA]', '')
    .replace(/\s+/g, ' ')
    .trim();
  return compactText(clean, 140);
}

export async function generateRemyReply(
  db: SupabaseClient,
  input: {
    businessUnitId: string;
    userText: string;
    history: RemyHistoryRow[];
    channel: RemyChannel;
    customerId?: string | null;
    conversationId?: string | null;
  },
) {
  const { data: config } = await db.from('integraciones_secretas')
    .select('ai_enabled,ai_provider,ai_model,ai_system_prompt')
    .eq('id', 'global')
    .maybeSingle();
  if (input.channel === 'whatsapp' && !config?.ai_enabled) throw new Error('remy_global_off');

  const runtime = await getAgentRuntimeConfig(db, 'remy', {
    provider: config?.ai_provider || 'gemini',
    model: config?.ai_model || DEFAULT_MODEL,
    executionMode: 'api',
  });
  if (!runtime.enabled) throw new Error('remy_runtime_disabled');
  if (runtime.executionMode !== 'api') throw new Error(`remy_execution_mode_not_supported:${runtime.executionMode}`);
  if (!['gemini', 'groq'].includes(runtime.provider)) throw new Error(`remy_provider_not_supported:${runtime.provider}`);

  const budget = getAgentContextBudget('remy', runtime.metadata);
  const [rawCatalog, memoryContext] = await Promise.all([
    loadRelevantCatalog(db, input.userText, input.businessUnitId),
    loadRelevantMemoryContext(db, {
      agent: 'remy',
      query: input.userText,
      businessUnitId: input.businessUnitId,
      entityId: input.customerId || null,
      maxChars: 120,
      maxItems: 2,
    }),
  ]);

  const history = compactHistory(input.history, budget);
  const catalog = compactText(rawCatalog, budget.maxBusinessContextChars);
  const memory = compactMemoryForRemy(memoryContext.text);
  const customPrompt = compactText(config?.ai_system_prompt || '', budget.maxBusinessContextChars);
  const model = runtime.model || DEFAULT_MODEL;
  const systemPrompt = `${basePrompt(catalog, input.channel)}${memory ? `\n\nREGLAS RECORDADAS RELEVANTES:\n${memory}` : ''}${customPrompt ? `\n\nREGLAS DEL NEGOCIO:\n${customPrompt}` : ''}`;

  const generated = await callAiProvider(db, {
    provider: runtime.provider,
    model,
    systemPrompt,
    messages: history,
    maxOutputTokens: budget.maxOutputTokens,
    temperature: 0.35,
  });
  const replyText = capCustomerReply(generated.text);
  if (!replyText) throw new Error('remy_empty_response');

  await recordLlmUsage(db, {
    businessUnitId: input.businessUnitId,
    conversationId: input.conversationId || null,
    agent: 'remy',
    provider: runtime.provider,
    model,
    usage: generated.usage,
    latencyMs: generated.latencyMs,
    metadata: {
      channel: input.channel,
      automatic: input.channel === 'whatsapp',
      runtime_mode: runtime.executionMode,
      history_messages: history.length,
      catalog_injected: Boolean(catalog),
      memory_items: memoryContext.count,
      token_budget: budget,
    },
  });

  return {
    text: replyText,
    model,
    provider: runtime.provider,
    historyMessages: history.length,
    catalogInjected: Boolean(catalog),
    memoryItems: memoryContext.count,
  };
}

export async function maybeAutoReply(db: SupabaseClient, persisted: PersistedMessage, inbound: NormalizedMessage): Promise<{ called: boolean; replied: boolean; reason?: string }> {
  if (persisted.duplicate || inbound.channel !== 'whatsapp' || inbound.direction !== 'inbound' || inbound.message_type !== 'text' || !inbound.text?.trim()) return { called: false, replied: false, reason: 'not_eligible' };

  const { data: conversation } = await db.from('conversations')
    .select('id,business_unit_id,ai_enabled,human_takeover,metadata,labels')
    .eq('id', persisted.conversationId)
    .maybeSingle();
  if (!conversation?.ai_enabled) return { called: false, replied: false, reason: 'conversation_off' };
  if (conversation.human_takeover) return { called: false, replied: false, reason: 'human_takeover' };
  if (conversation.metadata?.personal || conversation.labels?.includes?.('personal')) return { called: false, replied: false, reason: 'personal_contact' };
  if (!conversation.business_unit_id) return { called: false, replied: false, reason: 'missing_business_unit' };

  const inboundAt = new Date(inbound.sent_at).getTime();
  if (!Number.isFinite(inboundAt) || Date.now() - inboundAt > SERVICE_WINDOW_MS) return { called: false, replied: false, reason: 'service_window_closed' };

  const { data: recent } = await db.from('omnichannel_messages')
    .select('direction,body,created_at')
    .eq('conversation_id', persisted.conversationId)
    .not('body', 'is', null)
    .order('created_at', { ascending: false })
    .limit(4);
  const history: RemyHistoryRow[] = (recent || []).reverse().map((message: any) => ({
    direction: message.direction === 'outbound' ? 'outbound' : 'inbound',
    body: String(message.body || ''),
  }));

  let generated: Awaited<ReturnType<typeof generateRemyReply>>;
  try {
    generated = await generateRemyReply(db, {
      businessUnitId: conversation.business_unit_id,
      userText: inbound.text,
      history,
      channel: 'whatsapp',
      customerId: persisted.customerId || null,
      conversationId: persisted.conversationId,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'remy_generate_failed';
    return { called: false, replied: false, reason };
  }

  const sendResult = await sendMessage({ channel: 'whatsapp', conversationId: persisted.conversationId, customerId: persisted.customerId || undefined, to: inbound.external_thread_id, text: generated.text, mode: 'automatic', automationAuthorized: true, agent: 'remy' });

  await persistMessage(db, {
    channel: 'whatsapp', provider: 'meta', transport: 'cloud_api', provider_message_id: sendResult.providerMessageId,
    external_thread_id: inbound.external_thread_id, external_user_id: inbound.external_user_id, direction: 'outbound', sender_type: 'remy', text: generated.text,
    message_type: 'text', sent_at: new Date().toISOString(),
    raw_payload: { source: 'remy_ai', ai_provider: generated.provider, ai_model: generated.model, provider_response: sendResult.raw },
  });
  return { called: true, replied: true };
}
