import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { BusinessRepository } from '@/lib/repositories/business-repository';
import { generateRemyReply, type RemyHistoryRow } from '@/lib/ai/remy';
import { persistMessage } from '@/lib/messaging/messages';

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null) as { history?: unknown; sessionId?: unknown } | null;
    const browserHistory = normalizeHistory(body?.history);
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

    return NextResponse.json({ respuesta: generated.text, sessionId });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'remy_web_failed';
    console.error('remy_web_failed', { detail });
    return NextResponse.json(
      { respuesta: 'Ahora mismo no pude responder. Escríbenos por WhatsApp y te ayudamos enseguida.' },
      { status: 503 },
    );
  }
}
