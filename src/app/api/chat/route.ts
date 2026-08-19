import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { BusinessRepository } from '@/lib/repositories/business-repository';
import { generateRemyReply, type RemyHistoryRow } from '@/lib/ai/remy';
import { executeRemyTool, type RemyToolContext } from '@/lib/ai/remy-commerce';
import { persistMessage } from '@/lib/messaging/messages';
import type { ItemCarrito } from '@/types/domain';

export const dynamic = 'force-dynamic';

type ClientMessage = { role?: string; parts?: Array<{ text?: string }> };

const SIMPLE_CHECKOUT_START = /(?:quiero|deseo|vamos(?:\s+a)?).{0,20}(?:finalizar|confirmar|completar|hacer|crear).{0,20}(?:pedido|compra)|^(?:finalizar|confirmar).{0,15}(?:pedido|compra)$/i;

function normalizeHistory(value: unknown): RemyHistoryRow[] {
  if (!Array.isArray(value)) return [];
  return value.slice(-8).flatMap((message: ClientMessage) => {
    const role = message?.role === 'model' ? 'outbound' : message?.role === 'user' ? 'inbound' : null;
    const text = String(message?.parts?.[0]?.text || '').trim().slice(0, 1200);
    return role && text ? [{ direction: role, body: text } as RemyHistoryRow] : [];
  });
}

function validSessionId(value: unknown) {
  const session = String(value || '').trim();
  return /^[a-zA-Z0-9_-]{8,100}$/.test(session) ? session : null;
}

function normalizeCartItems(value: unknown): ItemCarrito[] | null {
  if (!Array.isArray(value)) return null;
  return value.slice(0, 20).flatMap((raw: any) => {
    const productoId = String(raw?.productoId || '').trim();
    const nombre = String(raw?.nombre || '').trim().slice(0, 160);
    const precio = Number(raw?.precio);
    const qty = Math.trunc(Number(raw?.qty));
    if (!productoId || !nombre || !Number.isFinite(precio) || precio < 0 || !Number.isFinite(qty) || qty <= 0 || qty > 20) return [];
    return [{
      productoId,
      nombre,
      precio,
      qty,
      emoji: String(raw?.emoji || '🌱').slice(0, 16),
      formato: raw?.formato ? String(raw.formato).trim().slice(0, 100) : null,
      variedad: raw?.variedad ? String(raw.variedad).trim().slice(0, 100) : null,
    } as ItemCarrito];
  });
}

async function syncBrowserCart(
  db: ReturnType<typeof createSupabaseServiceClient>,
  input: {
    businessUnitId: string;
    conversationId: string;
    customerId: string | null;
    sessionId: string;
    items: ItemCarrito[] | null;
  },
) {
  if (input.items === null) return;
  const { data: existing, error } = await db.from('carritos_abandonados')
    .select('id')
    .eq('business_unit_id', input.businessUnitId)
    .eq('conversation_id', input.conversationId)
    .eq('recuperado', false)
    .order('last_activity_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;

  // No creamos un carrito vacío solo porque el navegador nos informó [].
  // Sí vaciamos uno existente si el usuario lo dejó vacío desde la interfaz.
  if (!existing && input.items.length === 0) return;
  const subtotal = input.items.reduce((sum, item) => sum + Number(item.precio || 0) * Number(item.qty || 0), 0);
  const payload = {
    business_unit_id: input.businessUnitId,
    conversation_id: input.conversationId,
    customer_id: input.customerId,
    source_channel: 'web',
    identificador: input.sessionId,
    items: input.items,
    subtotal,
    recuperado: false,
    contactado: false,
    last_activity_at: new Date().toISOString(),
  };
  if (existing?.id) {
    const { error: updateError } = await db.from('carritos_abandonados').update(payload).eq('id', existing.id);
    if (updateError) throw updateError;
    return;
  }
  const { error: insertError } = await db.from('carritos_abandonados').insert(payload);
  if (insertError) throw insertError;
}

async function loadConversationCart(
  db: ReturnType<typeof createSupabaseServiceClient>,
  businessUnitId: string,
  conversationId: string,
): Promise<ItemCarrito[] | null> {
  const { data, error } = await db.from('carritos_abandonados')
    .select('items')
    .eq('business_unit_id', businessUnitId)
    .eq('conversation_id', conversationId)
    .eq('recuperado', false)
    .order('last_activity_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? (Array.isArray(data.items) ? data.items as ItemCarrito[] : []) : null;
}

function isSimpleCheckoutStart(text: string) {
  const clean = String(text || '').trim();
  return clean.length > 0 && clean.length <= 90 && SIMPLE_CHECKOUT_START.test(clean);
}

function parseVespucioChoice(text: string): 'inside' | 'outside' | null {
  const clean = String(text || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (!clean || clean.length > 50) return null;
  if (/\b(?:dentro|adentro|interior)\b/.test(clean)) return 'inside';
  if (/\b(?:fuera|afuera|exterior)\b/.test(clean)) return 'outside';
  return null;
}

async function resolveVespucioZone(
  db: ReturnType<typeof createSupabaseServiceClient>,
  choice: 'inside' | 'outside',
) {
  const pattern = choice === 'inside' ? '%dentro%vespucio%' : '%fuera%vespucio%';
  const { data, error } = await db.from('zonas')
    .select('id,nombre,precio')
    .ilike('nombre', pattern)
    .order('precio')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

function firstCheckoutQuestion(status: any): string | null {
  if (status?.cart?.empty) return 'Tu carrito está vacío. ¿Qué producto quieres agregar?';
  const missing = Array.isArray(status?.missing) ? status.missing.map(String) : [];
  if (!missing.length) return 'Ya tengo todos los datos necesarios. ¿Confirmas que cree el pedido?';

  switch (missing[0]) {
    case 'nombre': return 'Perfecto. Partamos por tu nombre: ¿a nombre de quién hacemos el pedido?';
    case 'direccion': return 'Perfecto. ¿Cuál es la dirección de entrega?';
    case 'comuna': return '¿En qué comuna es la entrega?';
    case 'phone': return '¿Qué teléfono dejamos para coordinar el pedido?';
    case 'zonaId': return '¿Tu dirección está dentro o fuera de Américo Vespucio?';
    case 'deliveryDate': return 'Ya tengo los datos anteriores. ¿Qué fecha de despacho prefieres?';
    case 'paymentMethod': return 'El medio online disponible es Mercado Pago. ¿Quieres pagar por Mercado Pago?';
    default: return null;
  }
}

async function persistWebReply(
  db: ReturnType<typeof createSupabaseServiceClient>,
  input: { sessionId: string; text: string; source: string; provider?: string; model?: string; fallbackFrom?: string | null },
) {
  await persistMessage(db, {
    channel: 'web',
    provider: 'web',
    transport: 'web',
    provider_message_id: `web_out_${randomUUID()}`,
    external_thread_id: input.sessionId,
    external_user_id: input.sessionId,
    direction: 'outbound',
    sender_type: 'remy',
    text: input.text,
    message_type: 'text',
    sent_at: new Date().toISOString(),
    raw_payload: {
      source: input.source,
      session_id: input.sessionId,
      ...(input.provider ? { ai_provider: input.provider } : {}),
      ...(input.model ? { ai_model: input.model } : {}),
      ...(input.fallbackFrom ? { fallback_from: input.fallbackFrom } : {}),
    },
  });
}

/**
 * Recupera la conversación web anónima de este navegador sin llamar al LLM.
 * La sesión es un UUID aleatorio persistido en localStorage; sólo permite leer
 * el hilo que usa exactamente ese external_conversation_id.
 */
export async function GET(request: NextRequest) {
  try {
    const sessionId = validSessionId(request.nextUrl.searchParams.get('sessionId'));
    if (!sessionId) return NextResponse.json({ error: 'invalid_session' }, { status: 400 });

    const db = createSupabaseServiceClient();
    const business = await new BusinessRepository(db).requireDefault();
    const { data: conversation, error: conversationError } = await db.from('conversations')
      .select('id')
      .eq('business_unit_id', business.id)
      .eq('channel', 'web')
      .eq('external_conversation_id', sessionId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (conversationError) throw conversationError;

    if (!conversation?.id) {
      return NextResponse.json({ sessionId, messages: [], cartItems: null });
    }

    const [{ data: rows, error: messagesError }, cartItems] = await Promise.all([
      db.from('omnichannel_messages')
        .select('direction,body,created_at')
        .eq('conversation_id', conversation.id)
        .not('body', 'is', null)
        .order('created_at', { ascending: false })
        .limit(40),
      loadConversationCart(db, business.id, conversation.id),
    ]);
    if (messagesError) throw messagesError;

    const messages = (rows || []).reverse().flatMap((row: any) => {
      const text = String(row.body || '').trim();
      if (!text) return [];
      return [{
        role: row.direction === 'outbound' ? 'model' : 'user',
        parts: [{ text }],
      }];
    });

    return NextResponse.json({ sessionId, messages, cartItems });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'remy_web_history_failed';
    console.error('remy_web_history_failed', { detail });
    return NextResponse.json({ error: 'history_unavailable' }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null) as { history?: unknown; sessionId?: unknown; cartItems?: unknown } | null;
    const browserHistory = normalizeHistory(body?.history);
    const browserCart = normalizeCartItems(body?.cartItems);
    const latestUser = [...browserHistory].reverse().find((message) => message.direction === 'inbound')?.body || 'Hola';
    const sessionId = validSessionId(body?.sessionId) || `web_${randomUUID()}`;

    const db = createSupabaseServiceClient();
    const business = await new BusinessRepository(db).requireDefault();
    const inbound = await persistMessage(db, {
      channel: 'web',
      provider: 'web',
      transport: 'web',
      provider_message_id: `web_in_${randomUUID()}`,
      external_thread_id: sessionId,
      external_user_id: sessionId,
      direction: 'inbound',
      sender_type: 'customer',
      text: latestUser,
      message_type: 'text',
      sent_at: new Date().toISOString(),
      raw_payload: { source: 'remy_web', session_id: sessionId },
    });

    await syncBrowserCart(db, {
      businessUnitId: business.id,
      conversationId: inbound.conversationId,
      customerId: inbound.customerId,
      sessionId,
      items: browserCart,
    });

    const toolContext: RemyToolContext = {
      businessUnitId: business.id,
      customerId: inbound.customerId,
      conversationId: inbound.conversationId,
      channel: 'web',
      externalUserId: sessionId,
      userText: latestUser,
    };

    // Si Remy preguntó dentro/fuera de Vespucio, resolvemos la zona real sin LLM.
    // Esto evita reinterpretar la comuna y ahorra una llamada completa al modelo.
    const vespucioChoice = parseVespucioChoice(latestUser);
    const previousAssistant = [...browserHistory].reverse().find((message) => message.direction === 'outbound')?.body || '';
    if (vespucioChoice && /vespucio/i.test(previousAssistant)) {
      const checkoutStatus = await executeRemyTool(db, toolContext, 'checkout_status', {});
      const missing = Array.isArray((checkoutStatus as any)?.missing) ? (checkoutStatus as any).missing.map(String) : [];
      if (missing.includes('zonaId')) {
        const zone = await resolveVespucioZone(db, vespucioChoice);
        if (zone?.id) {
          const updatedStatus = await executeRemyTool(db, toolContext, 'checkout_update', { zonaId: zone.id });
          const nextQuestion = firstCheckoutQuestion(updatedStatus) || '¿Quieres continuar con el pedido?';
          const deterministicText = `Perfecto. Despacho ${vespucioChoice === 'inside' ? 'dentro' : 'fuera'} de Américo Vespucio: $${Number(zone.precio || 0).toLocaleString('es-CL')}. ${nextQuestion}`;
          await persistWebReply(db, {
            sessionId,
            text: deterministicText,
            source: 'remy_web_shipping_zone_rules',
            provider: 'synthetiq',
            model: 'shipping-zone-rules',
          });
          const cartItems = await loadConversationCart(db, business.id, inbound.conversationId);
          return NextResponse.json({ respuesta: deterministicText, sessionId, cartItems });
        }
      }
    }

    // Este arranque de checkout es determinista: una sola pregunta y cero tokens.
    // El resto de la conversación sigue usando el mismo Remy/LLM y sus tools.
    if (isSimpleCheckoutStart(latestUser)) {
      const checkoutStatus = await executeRemyTool(db, toolContext, 'checkout_status', {});
      const deterministicText = firstCheckoutQuestion(checkoutStatus);
      if (deterministicText) {
        await persistWebReply(db, {
          sessionId,
          text: deterministicText,
          source: 'remy_web_checkout_rules',
          provider: 'synthetiq',
          model: 'checkout-rules',
        });
        const cartItems = await loadConversationCart(db, business.id, inbound.conversationId);
        return NextResponse.json({ respuesta: deterministicText, sessionId, cartItems });
      }
    }

    const { data: recent } = await db.from('omnichannel_messages')
      .select('direction,body,created_at')
      .eq('conversation_id', inbound.conversationId)
      .not('body', 'is', null)
      .order('created_at', { ascending: false })
      .limit(4);
    const history: RemyHistoryRow[] = (recent || []).reverse().map((message: any) => ({
      direction: message.direction === 'outbound' ? 'outbound' : 'inbound',
      body: String(message.body || ''),
    }));

    const generated = await generateRemyReply(db, {
      businessUnitId: business.id,
      userText: latestUser,
      history: history.length ? history : [{ direction: 'inbound', body: latestUser }],
      channel: 'web',
      customerId: inbound.customerId,
      conversationId: inbound.conversationId,
      externalUserId: sessionId,
    });

    await persistWebReply(db, {
      sessionId,
      text: generated.text,
      source: 'remy_web',
      provider: generated.provider,
      model: generated.model,
      fallbackFrom: generated.fallbackFrom,
    });

    const cartItems = await loadConversationCart(db, business.id, inbound.conversationId);
    return NextResponse.json({ respuesta: generated.text, sessionId, cartItems });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'remy_web_failed';
    console.error('remy_web_failed', { detail });
    return NextResponse.json(
      { respuesta: 'Ahora mismo no pude responder. Escríbenos por WhatsApp y te ayudamos enseguida.' },
      { status: 503 },
    );
  }
}