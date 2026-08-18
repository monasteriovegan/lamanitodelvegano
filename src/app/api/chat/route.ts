import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { BusinessRepository } from '@/lib/repositories/business-repository';
import { generateRemyReply, type RemyHistoryRow } from '@/lib/ai/remy';
import { persistMessage } from '@/lib/messaging/messages';
import type { ItemCarrito } from '@/types/domain';

export const dynamic = 'force-dynamic';

type ClientMessage = { role?: string; parts?: Array<{ text?: string }> };

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

    await persistMessage(db, {
      channel: 'web',
      provider: 'web',
      transport: 'web',
      provider_message_id: `web_out_${randomUUID()}`,
      external_thread_id: sessionId,
      external_user_id: sessionId,
      direction: 'outbound',
      sender_type: 'remy',
      text: generated.text,
      message_type: 'text',
      sent_at: new Date().toISOString(),
      raw_payload: { source: 'remy_web', session_id: sessionId, ai_provider: generated.provider, ai_model: generated.model, fallback_from: generated.fallbackFrom },
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
