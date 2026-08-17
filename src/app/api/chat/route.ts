import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { BusinessRepository } from '@/lib/repositories/business-repository';
import { generateRemyReply, type RemyHistoryRow } from '@/lib/ai/remy';

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null) as { history?: unknown } | null;
    const history = normalizeHistory(body?.history);
    const latestUser = [...history].reverse().find((message) => message.direction === 'inbound')?.body || 'Hola';

    const db = createSupabaseServiceClient();
    const business = await new BusinessRepository(db).requireDefault();
    const generated = await generateRemyReply(db, {
      businessUnitId: business.id,
      userText: latestUser,
      history: history.length ? history : [{ direction: 'inbound', body: 'Hola' }],
      channel: 'web',
    });

    return NextResponse.json({ respuesta: generated.text });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'remy_web_failed';
    console.error('remy_web_failed', { detail });
    return NextResponse.json(
      { respuesta: 'Ahora mismo no pude responder. Escríbenos por WhatsApp y te ayudamos enseguida.' },
      { status: 503 },
    );
  }
}
