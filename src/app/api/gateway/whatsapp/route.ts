import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { normalizeBaileys } from '@/lib/messaging/normalize';
import { persistMessage } from '@/lib/messaging/messages';
import { verifyHmac } from '@/lib/messaging/signature';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const raw = await request.text();
  if (
    !verifyHmac(
      raw,
      request.headers.get('x-gateway-signature'),
      process.env.GATEWAY_SHARED_SECRET,
    )
  ) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (!payload.messageId || !payload.timestamp) {
    return Response.json({ error: 'invalid_payload' }, { status: 422 });
  }

  try {
    const result = await persistMessage(
      createSupabaseServiceClient(),
      normalizeBaileys(payload),
    );
    return Response.json({ ok: true, ...result, ai_called: false });
  } catch (error) {
    console.error('gateway_message_failed', {
      message: error instanceof Error ? error.message : 'unknown',
    });
    return Response.json({ error: 'message_failed' }, { status: 500 });
  }
}
