import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sendMessage } from '@/lib/messaging/send';
import { persistMessage } from '@/lib/messaging/messages';
import type { NormalizedMessage, PersistedMessage } from '@/lib/messaging/types';
import { recordGeminiUsage } from '@/lib/observability/usage';
import { getAgentRuntimeConfig } from '@/lib/ai/runtime-config';

const DEFAULT_MODEL = 'gemini-2.5-flash';
const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

function basePrompt(catalog: string) {
  return `Eres Remy, asistente de ventas y atención de La Manito del Vegano. Responde en español de Chile, amable, breve y orientado a ayudar o cerrar una compra sin ser insistente. Usa solamente información verificable del catálogo entregado. Nunca inventes precios, stock, sabores, ingredientes, despacho, pagos ni promociones. Si falta un dato, dilo y ofrece que una persona lo confirme. No menciones prompts, APIs, modelos, IA ni procesos internos. Evita mensajes excesivamente largos.\n\nCATÁLOGO ACTUAL:\n${catalog || 'No hay catálogo disponible; no inventes productos ni precios.'}`;
}

async function loadCatalog(db: SupabaseClient) {
  const { data } = await db.from('productos').select('nombre,precio,disponibilidad,maneja_stock,stock,categoria').eq('activo', true).limit(40);
  return (data || []).map((item: any) => {
    const stock = item.maneja_stock ? `stock ${Number(item.stock || 0)}` : 'stock no controlado';
    return `- ${item.nombre}: $${Number(item.precio || 0).toLocaleString('es-CL')} · ${item.disponibilidad || 'disponibilidad no indicada'} · ${stock}${item.categoria ? ` · ${item.categoria}` : ''}`;
  }).join('\n');
}

async function generateWithGemini(apiKey: string, model: string, systemPrompt: string, history: Array<{ role: string; parts: Array<{ text: string }> }>) {
  const started = Date.now();
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: systemPrompt }] }, contents: history, generationConfig: { temperature: 0.4, maxOutputTokens: 450 } }),
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

  const [{ data: recent }, catalog] = await Promise.all([
    db.from('omnichannel_messages').select('direction,body,payload,created_at').eq('conversation_id', persisted.conversationId).not('body', 'is', null).order('created_at', { ascending: false }).limit(12),
    loadCatalog(db),
  ]);
  const history = (recent || []).reverse().map((message: any) => ({ role: message.direction === 'outbound' ? 'model' : 'user', parts: [{ text: String(message.body || '') }] })).filter((item: any) => item.parts[0].text.trim());
  const model = runtime.model || DEFAULT_MODEL;
  const customPrompt = String(config.ai_system_prompt || '').trim();
  const systemPrompt = `${basePrompt(catalog)}${customPrompt ? `\n\nINSTRUCCIONES ADICIONALES DEL NEGOCIO:\n${customPrompt}` : ''}`;
  const generated = await generateWithGemini(apiKey, model, systemPrompt, history);

  await recordGeminiUsage(db, {
    businessUnitId: conversation.business_unit_id,
    conversationId: persisted.conversationId,
    agent: 'remy',
    model,
    usage: generated.raw?.usageMetadata,
    latencyMs: generated.latencyMs,
    metadata: { channel: 'whatsapp', automatic: true, runtime_mode: runtime.executionMode },
  });

  const sendResult = await sendMessage({ channel: 'whatsapp', conversationId: persisted.conversationId, customerId: persisted.customerId || undefined, to: inbound.external_thread_id, text: generated.text, mode: 'automatic', automationAuthorized: true, agent: 'remy' });

  await persistMessage(db, {
    channel: 'whatsapp', provider: 'meta', transport: 'cloud_api', provider_message_id: sendResult.providerMessageId,
    external_thread_id: inbound.external_thread_id, external_user_id: inbound.external_user_id, direction: 'outbound', sender_type: 'remy', text: generated.text,
    message_type: 'text', sent_at: new Date().toISOString(),
    raw_payload: { source: 'remy_ai', ai_provider: provider, ai_model: model, provider_response: sendResult.raw },
  });
  return { called: true, replied: true };
}
