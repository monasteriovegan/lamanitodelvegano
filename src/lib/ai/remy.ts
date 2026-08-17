import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sendMessage } from '@/lib/messaging/send';
import { persistMessage } from '@/lib/messaging/messages';
import type { NormalizedMessage, PersistedMessage } from '@/lib/messaging/types';
import { recordGeminiUsage } from '@/lib/observability/usage';
import { getAgentRuntimeConfig } from '@/lib/ai/runtime-config';
import { compactText, getAgentContextBudget, type AgentContextBudget } from '@/lib/ai/context-budget';
import { loadRelevantMemoryContext } from '@/lib/ai/memory';

const DEFAULT_MODEL = 'gemini-2.5-flash';
const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;
const CATALOG_INTENT = /producto|cat[aá]logo|precio|valor|stock|disponib|sabor|barra|bomb[oó]n|alfajor|trufa|torta|box|manjar|prote[ií]n|chocolate/i;
const STOP_WORDS = new Set(['hola','quiero','tienen','tiene','cuanto','cuánto','cuesta','precio','valor','producto','productos','disponible','disponibles','para','como','cómo','esto','esta','este','unos','unas','alguno','alguna','dame','favor']);

function basePrompt(catalog: string) {
  return `Eres Remy, asistente de ventas y atención de La Manito del Vegano. Habla en español de Chile, cercano y natural. Responde normalmente en 1-2 frases y no superes unos 280 caracteres salvo que una lista sea imprescindible. Haz como máximo una pregunta a la vez. Ayuda a comprar sin presionar. Usa solo datos verificables entregados en este contexto; nunca inventes precios, stock, sabores, ingredientes, despacho, pagos ni promociones. Si falta un dato, dilo brevemente y ofrece confirmarlo. No menciones IA, prompts, APIs ni procesos internos.${catalog ? `\n\nCATÁLOGO RELEVANTE:\n${catalog}` : ''}`;
}

function searchTerms(text: string) {
  return text.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 4 && !STOP_WORDS.has(word))
    .slice(0, 3);
}

async function loadRelevantCatalog(db: SupabaseClient, userText: string) {
  if (!CATALOG_INTENT.test(userText)) return '';
  const select = 'nombre,precio,disponibilidad,maneja_stock,stock,categoria';
  const terms = searchTerms(userText);
  let rows: any[] = [];

  if (terms.length) {
    const clauses = terms.flatMap((term) => {
      const safe = term.replace(/[,%_()]/g, '');
      return [`nombre.ilike.%${safe}%`, `categoria.ilike.%${safe}%`];
    });
    const { data } = await db.from('productos').select(select).eq('activo', true).or(clauses.join(',')).order('nombre').limit(8);
    rows = data || [];
  }

  if (!rows.length) {
    const { data } = await db.from('productos').select(select).eq('activo', true).order('nombre').limit(8);
    rows = data || [];
  }

  return rows.map((item: any) => {
    const stock = item.maneja_stock ? `stock ${Number(item.stock || 0)}` : '';
    return `- ${item.nombre}: $${Number(item.precio || 0).toLocaleString('es-CL')}${item.disponibilidad ? ` · ${item.disponibilidad}` : ''}${stock ? ` · ${stock}` : ''}${item.categoria ? ` · ${item.categoria}` : ''}`;
  }).join('\n');
}

function compactHistory(rows: any[], budget: AgentContextBudget) {
  const selected: Array<{ role: string; parts: Array<{ text: string }> }> = [];
  let chars = 0;
  for (let i = rows.length - 1; i >= 0 && selected.length < budget.maxHistoryMessages; i -= 1) {
    const message = rows[i];
    const text = compactText(message.body || '', budget.maxMessageChars);
    if (!text) continue;
    if (selected.length > 0 && chars + text.length > budget.maxHistoryChars) break;
    selected.push({ role: message.direction === 'outbound' ? 'model' : 'user', parts: [{ text }] });
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

async function generateWithGemini(apiKey: string, model: string, systemPrompt: string, history: Array<{ role: string; parts: Array<{ text: string }> }>, maxOutputTokens: number) {
  const started = Date.now();
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: systemPrompt }] }, contents: history, generationConfig: { temperature: 0.35, maxOutputTokens } }),
    cache: 'no-store',
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`gemini_generate_failed:${response.status}`);
  const text = (body?.candidates?.[0]?.content?.parts || []).map((part: any) => typeof part?.text === 'string' ? part.text : '').join('').trim();
  if (!text) throw new Error('gemini_empty_response');
  return { text, raw: body, latencyMs: Date.now() - started };
}

export async function maybeAutoReply(db: SupabaseClient, persisted: PersistedMessage, inbound: NormalizedMessage): Promise<{ called: boolean; replied: boolean; reason?: string }> {
  if (persisted.duplicate || inbound.channel !== 'whatsapp' || inbound.direction !== 'inbound' || inbound.message_type !== 'text' || !inbound.text?.trim()) return { called: false, replied: false, reason: 'not_eligible' };

  const [{ data: config }, { data: conversation }] = await Promise.all([
    db.from('integraciones_secretas').select('ai_enabled,ai_provider,ai_model,ai_system_prompt,gemini_api_key').eq('id', 'global').maybeSingle(),
    db.from('conversations').select('id,business_unit_id,ai_enabled,human_takeover,metadata,labels').eq('id', persisted.conversationId).maybeSingle(),
  ]);
  if (!config?.ai_enabled) return { called: false, replied: false, reason: 'global_off' };
  if (!conversation?.ai_enabled) return { called: false, replied: false, reason: 'conversation_off' };
  if (conversation.human_takeover) return { called: false, replied: false, reason: 'human_takeover' };
  if (conversation.metadata?.personal || conversation.labels?.includes?.('personal')) return { called: false, replied: false, reason: 'personal_contact' };

  const inboundAt = new Date(inbound.sent_at).getTime();
  if (!Number.isFinite(inboundAt) || Date.now() - inboundAt > SERVICE_WINDOW_MS) return { called: false, replied: false, reason: 'service_window_closed' };

  const runtime = await getAgentRuntimeConfig(db, 'remy', {
    provider: config?.ai_provider || 'gemini',
    model: config?.ai_model || DEFAULT_MODEL,
    executionMode: 'api',
  });
  if (!runtime.enabled) return { called: false, replied: false, reason: 'agent_runtime_off' };
  if (runtime.executionMode !== 'api') return { called: false, replied: false, reason: 'unsupported_execution_mode' };
  const provider = runtime.provider;
  if (provider !== 'gemini') return { called: false, replied: false, reason: 'unsupported_provider' };
  const apiKey = String(config.gemini_api_key || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '');
  if (!apiKey) return { called: false, replied: false, reason: 'missing_gemini_key' };
  const budget = getAgentContextBudget('remy', runtime.metadata);

  const [{ data: recent }, rawCatalog, memoryContext] = await Promise.all([
    db.from('omnichannel_messages').select('direction,body,created_at').eq('conversation_id', persisted.conversationId).not('body', 'is', null).order('created_at', { ascending: false }).limit(budget.maxHistoryMessages),
    loadRelevantCatalog(db, inbound.text),
    loadRelevantMemoryContext(db, {
      agent: 'remy',
      query: inbound.text,
      businessUnitId: conversation.business_unit_id,
      entityId: persisted.customerId || null,
      maxChars: 120,
      maxItems: 2,
    }),
  ]);
  const history = compactHistory((recent || []).reverse(), budget);
  const catalog = compactText(rawCatalog, budget.maxBusinessContextChars);
  const memory = compactMemoryForRemy(memoryContext.text);
  const model = runtime.model || DEFAULT_MODEL;
  const customPrompt = compactText(config.ai_system_prompt || '', budget.maxBusinessContextChars);
  const systemPrompt = `${basePrompt(catalog)}${memory ? `\n\nREGLAS RECORDADAS RELEVANTES:\n${memory}` : ''}${customPrompt ? `\n\nREGLAS DEL NEGOCIO:\n${customPrompt}` : ''}`;
  const generated = await generateWithGemini(apiKey, model, systemPrompt, history, budget.maxOutputTokens);
  const replyText = capCustomerReply(generated.text);

  await recordGeminiUsage(db, {
    businessUnitId: conversation.business_unit_id,
    conversationId: persisted.conversationId,
    agent: 'remy',
    model,
    usage: generated.raw?.usageMetadata,
    latencyMs: generated.latencyMs,
    metadata: {
      channel: 'whatsapp', automatic: true, runtime_mode: runtime.executionMode,
      history_messages: history.length, catalog_injected: Boolean(catalog), memory_items: memoryContext.count,
      token_budget: budget,
    },
  });

  const sendResult = await sendMessage({ channel: 'whatsapp', conversationId: persisted.conversationId, customerId: persisted.customerId || undefined, to: inbound.external_thread_id, text: replyText, mode: 'automatic', automationAuthorized: true, agent: 'remy' });

  await persistMessage(db, {
    channel: 'whatsapp', provider: 'meta', transport: 'cloud_api', provider_message_id: sendResult.providerMessageId,
    external_thread_id: inbound.external_thread_id, external_user_id: inbound.external_user_id, direction: 'outbound', sender_type: 'remy', text: replyText,
    message_type: 'text', sent_at: new Date().toISOString(),
    raw_payload: { source: 'remy_ai', ai_provider: provider, ai_model: model, provider_response: sendResult.raw },
  });
  return { called: true, replied: true };
}
