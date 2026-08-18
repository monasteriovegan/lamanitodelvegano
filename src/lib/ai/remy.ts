import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sendMessage } from '@/lib/messaging/send';
import { persistMessage } from '@/lib/messaging/messages';
import type { NormalizedMessage, PersistedMessage } from '@/lib/messaging/types';
import { recordLlmUsage } from '@/lib/observability/usage';
import { getAgentRuntimeConfig } from '@/lib/ai/runtime-config';
import { compactJsonForModel, compactText, getAgentContextBudget, type AgentContextBudget } from '@/lib/ai/context-budget';
import { loadRelevantMemoryContext } from '@/lib/ai/memory';
import { callAiProvider, type ProviderMessage, type ProviderResponse } from '@/lib/ai/providers';
import { executeRemyTool, selectRemyTools, type RemyToolContext } from '@/lib/ai/remy-commerce';
import { understandWhatsAppMedia } from '@/lib/ai/remy-media';
import { loadRemyDeliveryContext } from '@/lib/ai/remy-delivery';
import { activateHumanHandoff, getHumanTakeover, shouldHandoffToHuman } from '@/lib/ai/remy-handoff';
import { loadRemyPaymentContext } from '@/lib/ai/remy-payment';

const DEFAULT_MODEL = 'gemini-2.5-flash';
const FALLBACK_MODEL = 'gemini-2.5-flash';
const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;
const CATALOG_INTENT = /producto|cat[aá]logo|precio|valor|stock|disponib|sabor|barra|bomb[oó]n|alfajor|trufa|torta|box|manjar|prote[ií]n|chocolate|seit[aá]n|lomo|kostill/i;
const STOP_WORDS = new Set(['hola','quiero','tienen','tiene','cuanto','cuánto','cuesta','precio','valor','producto','productos','disponible','disponibles','para','como','cómo','esto','esta','este','unos','unas','alguno','alguna','dame','favor']);
const WHATSAPP_MEDIA_TYPES = new Set(['audio', 'image', 'video', 'document']);

export type RemyChannel = 'whatsapp' | 'instagram' | 'web';
export type RemyHistoryRow = { direction: 'inbound' | 'outbound'; body: string };

function basePrompt(catalog: string, channel: RemyChannel) {
  const channelRule = channel === 'web'
    ? ' En la web, cuando el cliente quiera comprar puedes ayudarlo con el carrito conversacional; si necesita el checkout visual también puedes indicarle que use el carrito de la tienda.'
    : channel === 'whatsapp'
      ? ' En WhatsApp puedes consultar productos, modificar el carrito conversacional, cotizar despacho, guardar datos, crear un pedido confirmado y entregar un link de pago usando las herramientas disponibles.'
      : ' En Instagram puedes orientar la venta y usar las herramientas comerciales disponibles cuando correspondan.';
  return `Eres Remy, asistente de ventas y atención de La Manito del Vegano. Habla en español de Chile, cercano y natural. Responde normalmente en 1-2 frases y no superes unos 280 caracteres salvo que una lista sea imprescindible. Haz como máximo una pregunta a la vez. Ayuda a comprar sin presionar. Usa solo datos verificables entregados en este contexto o devueltos por herramientas; nunca inventes precios, stock, sabores, ingredientes, despacho, pagos ni promociones. Si falta un dato, dilo brevemente y pide solo el siguiente dato necesario. Si el cliente acepta una oferta de ayuda con “sí”, “por favor”, “dale” o equivalente, avanza al siguiente paso útil y no repitas precio o stock ya informado salvo que pida confirmación. Nunca digas que agregaste, quitaste, creaste, pagaste o confirmaste algo si la herramienta no lo hizo correctamente. Solo crea un pedido real cuando el cliente lo haya confirmado explícitamente. Si una herramienta devuelve un link de pago, entrégalo claramente al cliente. Solo ofrece métodos de pago marcados como configurados en el contexto; nunca inventes datos bancarios. Si el cliente pide atención humana, reclama, solicita devolución/reembolso o presenta un problema de pago/pedido que requiere intervención, deriva y no improvises una solución irreversible. No menciones IA, prompts, APIs ni procesos internos.${channelRule}${catalog ? `\n\nCATÁLOGO RELEVANTE:\n${catalog}` : ''}`;
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

function channelEnabled(metadata: Record<string, unknown>, channel: RemyChannel) {
  if (channel === 'web') return true;
  const channels = metadata?.channels && typeof metadata.channels === 'object'
    ? metadata.channels as Record<string, unknown>
    : {};
  if (channel === 'instagram') return channels.instagram === true;
  return true;
}

function toolResultMessage(value: unknown, budget: AgentContextBudget) {
  const compact = compactJsonForModel(value, Math.max(300, budget.maxToolResultChars || 600));
  return JSON.stringify(compact);
}

function deterministicReply(text: string, historyMessages: number) {
  return {
    text,
    model: 'human-handoff',
    provider: 'synthetiq',
    historyMessages,
    catalogInjected: false,
    memoryItems: 0,
    fallbackFrom: null,
  };
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
    externalUserId?: string | null;
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
  if (!channelEnabled(runtime.metadata || {}, input.channel)) throw new Error(`remy_channel_off:${input.channel}`);
  if (runtime.executionMode !== 'api') throw new Error(`remy_execution_mode_not_supported:${runtime.executionMode}`);
  if (!['gemini', 'groq'].includes(runtime.provider)) throw new Error(`remy_provider_not_supported:${runtime.provider}`);

  const budget = getAgentContextBudget('remy', runtime.metadata);
  if (input.conversationId) {
    const humanTakeover = await getHumanTakeover(db, input.conversationId);
    if (humanTakeover) {
      return deterministicReply('Esta conversación ya quedó derivada a atención humana. Una persona del equipo continuará contigo por aquí.', Math.min(input.history.length, budget.maxHistoryMessages));
    }
    if (shouldHandoffToHuman(input.userText)) {
      const text = await activateHumanHandoff(db, {
        conversationId: input.conversationId,
        customerId: input.customerId || null,
        reasonText: input.userText,
      });
      return deterministicReply(text, Math.min(input.history.length, budget.maxHistoryMessages));
    }
  }

  const [rawCatalog, memoryContext, deliveryContext, paymentContext] = await Promise.all([
    loadRelevantCatalog(db, input.userText, input.businessUnitId),
    loadRelevantMemoryContext(db, {
      agent: 'remy',
      query: input.userText,
      businessUnitId: input.businessUnitId,
      entityId: input.customerId || null,
      maxChars: 120,
      maxItems: 2,
    }),
    loadRemyDeliveryContext(db, {
      userText: input.userText,
      businessUnitId: input.businessUnitId,
      conversationId: input.conversationId || null,
      externalUserId: input.externalUserId || null,
    }),
    loadRemyPaymentContext(db, input.userText),
  ]);

  const history = compactHistory(input.history, budget);
  const catalog = compactText(rawCatalog, budget.maxBusinessContextChars);
  const memory = compactMemoryForRemy(memoryContext.text);
  const delivery = compactText(deliveryContext, budget.maxBusinessContextChars);
  const payment = compactText(paymentContext, budget.maxBusinessContextChars);
  const customPrompt = compactText(config?.ai_system_prompt || '', budget.maxBusinessContextChars);
  const systemPrompt = `${basePrompt(catalog, input.channel)}${memory ? `\n\nREGLAS RECORDADAS RELEVANTES:\n${memory}` : ''}${delivery ? `\n\nDATOS DE DESPACHO RELEVANTES:\n${delivery}` : ''}${payment ? `\n\nDATOS DE PAGO VERIFICADOS:\n${payment}` : ''}${customPrompt ? `\n\nREGLAS DEL NEGOCIO:\n${customPrompt}` : ''}`;
  const tools = selectRemyTools(input.userText);
  const toolContext: RemyToolContext = {
    businessUnitId: input.businessUnitId,
    customerId: input.customerId || null,
    conversationId: input.conversationId || null,
    channel: input.channel,
    externalUserId: input.externalUserId || null,
    userText: input.userText,
  };

  let provider = runtime.provider;
  let model = runtime.model || DEFAULT_MODEL;
  let fallbackFrom: string | null = null;
  const messages: ProviderMessage[] = [...history];
  let finalResponse: ProviderResponse | null = null;

  for (let round = 0; round < 4; round += 1) {
    let generated: ProviderResponse;
    try {
      generated = await callAiProvider(db, {
        provider,
        model,
        systemPrompt,
        messages,
        tools: tools.length ? tools : undefined,
        maxOutputTokens: budget.maxOutputTokens,
        temperature: 0.3,
      });
    } catch (error) {
      if (provider === 'gemini') throw error;
      fallbackFrom = `${provider}:${model}`;
      provider = 'gemini';
      model = FALLBACK_MODEL;
      generated = await callAiProvider(db, {
        provider,
        model,
        systemPrompt,
        messages,
        tools: tools.length ? tools : undefined,
        maxOutputTokens: budget.maxOutputTokens,
        temperature: 0.3,
      });
    }

    await recordLlmUsage(db, {
      businessUnitId: input.businessUnitId,
      conversationId: input.conversationId || null,
      agent: 'remy',
      provider,
      model,
      usage: generated.usage,
      latencyMs: generated.latencyMs,
      metadata: {
        channel: input.channel,
        automatic: input.channel !== 'web',
        runtime_mode: runtime.executionMode,
        history_messages: history.length,
        catalog_injected: Boolean(catalog),
        delivery_injected: Boolean(delivery),
        payment_context_injected: Boolean(payment),
        memory_items: memoryContext.count,
        token_budget: budget,
        tool_round: round,
        tools_available: tools.map((tool) => tool.name),
        tool_calls: generated.toolCalls.map((call) => call.name),
        fallback_from: fallbackFrom,
      },
    });

    if (!generated.toolCalls.length) {
      finalResponse = generated;
      break;
    }

    messages.push(generated.assistantMessage);
    for (const call of generated.toolCalls) {
      let result: unknown;
      try {
        result = await executeRemyTool(db, toolContext, call.name, call.args || {});
      } catch (error) {
        result = { ok: false, error: error instanceof Error ? error.message : 'tool_failed' };
      }
      messages.push({
        role: 'tool',
        toolCallId: call.id,
        name: call.name,
        content: toolResultMessage(result, budget),
      });
    }
  }

  if (!finalResponse) {
    finalResponse = await callAiProvider(db, {
      provider,
      model,
      systemPrompt: `${systemPrompt}\n\nNo llames más herramientas. Explica brevemente el resultado disponible y pide solo el siguiente dato si falta algo.`,
      messages,
      maxOutputTokens: budget.maxOutputTokens,
      temperature: 0.25,
    });
    await recordLlmUsage(db, {
      businessUnitId: input.businessUnitId,
      conversationId: input.conversationId || null,
      agent: 'remy',
      provider,
      model,
      usage: finalResponse.usage,
      latencyMs: finalResponse.latencyMs,
      metadata: { channel: input.channel, automatic: input.channel !== 'web', final_after_tool_limit: true, fallback_from: fallbackFrom },
    });
  }

  const replyText = capCustomerReply(finalResponse.text);
  if (!replyText) throw new Error('remy_empty_response');

  return {
    text: replyText,
    model,
    provider,
    historyMessages: history.length,
    catalogInjected: Boolean(catalog),
    memoryItems: memoryContext.count,
    fallbackFrom,
  };
}

export async function maybeAutoReply(db: SupabaseClient, persisted: PersistedMessage, inbound: NormalizedMessage): Promise<{ called: boolean; replied: boolean; reason?: string }> {
  const eligibleChannel = inbound.channel === 'whatsapp' || inbound.channel === 'instagram';
  const textMessage = inbound.message_type === 'text' && Boolean(inbound.text?.trim());
  const whatsappMedia = inbound.channel === 'whatsapp' && WHATSAPP_MEDIA_TYPES.has(inbound.message_type);
  if (persisted.duplicate || !eligibleChannel || inbound.direction !== 'inbound' || (!textMessage && !whatsappMedia)) {
    return { called: false, replied: false, reason: 'not_eligible' };
  }

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

  let userText = String(inbound.text || '').trim();
  if (whatsappMedia) {
    try {
      const understood = await understandWhatsAppMedia(db, inbound, {
        businessUnitId: conversation.business_unit_id,
        conversationId: persisted.conversationId,
      });
      if (understood) userText = [userText, understood].filter(Boolean).join('\n');
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'media_understanding_failed';
      console.error('remy_media_understanding_failed', { conversationId: persisted.conversationId, reason });
      userText = userText || `[El cliente envió un ${inbound.message_type}, pero no fue posible interpretarlo automáticamente. No inventes su contenido; pide al cliente que escriba brevemente qué necesita.]`;
    }
  }

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
  if (userText && (!history.length || history[history.length - 1]?.body !== userText)) history.push({ direction: 'inbound', body: userText });

  let generated: Awaited<ReturnType<typeof generateRemyReply>>;
  try {
    generated = await generateRemyReply(db, {
      businessUnitId: conversation.business_unit_id,
      userText,
      history,
      channel: inbound.channel as 'whatsapp' | 'instagram',
      customerId: persisted.customerId || null,
      conversationId: persisted.conversationId,
      externalUserId: inbound.external_user_id,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'remy_generate_failed';
    return { called: false, replied: false, reason };
  }

  const sendResult = await sendMessage({
    channel: inbound.channel as 'whatsapp' | 'instagram',
    conversationId: persisted.conversationId,
    customerId: persisted.customerId || undefined,
    to: inbound.external_thread_id,
    text: generated.text,
    mode: 'automatic',
    automationAuthorized: true,
    agent: 'remy',
  });

  await persistMessage(db, {
    channel: inbound.channel as 'whatsapp' | 'instagram',
    provider: 'meta',
    transport: inbound.channel === 'whatsapp' ? 'cloud_api' : 'instagram_api',
    provider_message_id: sendResult.providerMessageId,
    external_thread_id: inbound.external_thread_id,
    external_user_id: inbound.external_user_id,
    direction: 'outbound',
    sender_type: 'remy',
    text: generated.text,
    message_type: 'text',
    sent_at: new Date().toISOString(),
    raw_payload: { source: 'remy_ai', ai_provider: generated.provider, ai_model: generated.model, fallback_from: generated.fallbackFrom, provider_response: sendResult.raw },
  });
  return { called: true, replied: true };
}
