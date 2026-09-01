import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { normalizeMetaInstagram } from '@/lib/messaging/normalize';
import { persistMessage } from '@/lib/messaging/messages';
import { verifyHmacAny } from '@/lib/messaging/signature';
import { maybeAutoReply } from '@/lib/ai/remy';
import { autoRegisterInstagramConversationSale, shouldAttemptInstagramAutoSale } from '@/lib/orders/instagram-auto-sale';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const db = createSupabaseServiceClient();
  const { data: config } = await db
    .from('integraciones_secretas')
    .select('wa_verify_token')
    .eq('id', 'global')
    .maybeSingle();

  const expected = process.env.META_WEBHOOK_VERIFY_TOKEN || config?.wa_verify_token;
  if (mode === 'subscribe' && token && expected && token === expected) {
    return new Response(challenge, { status: 200 });
  }

  return new Response('Verificación fallida', { status: 403 });
}

export async function POST(request: Request) {
  const raw = await request.text();
  const validSignature = verifyHmacAny(raw, request.headers.get('x-hub-signature-256'), [
    process.env.META_APP_SECRET,
    process.env.META_BRIDGE_APP_SECRET,
  ]);
  if (!validSignature) {
    console.error('instagram_webhook_invalid_signature', {
      has_primary_secret: Boolean(process.env.META_APP_SECRET),
      has_bridge_secret: Boolean(process.env.META_BRIDGE_APP_SECRET),
    });
    return Response.json({ error: 'invalid_signature' }, { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (payload?.object !== 'instagram') {
    return Response.json({ ok: true, ignored: true, stored: 0, duplicates: 0, ai_called: false, ai_replied: false, orders_synced: 0 });
  }

  const db = createSupabaseServiceClient();
  let stored = 0;
  let duplicates = 0;
  let aiCalled = 0;
  let aiReplied = 0;
  let ordersSynced = 0;

  try {
    for (const message of normalizeMetaInstagram(payload)) {
      const result = await persistMessage(db, message);
      result.duplicate ? (duplicates += 1) : (stored += 1);

      if (!result.duplicate && message.direction === 'inbound') {
        try {
          const ai = await maybeAutoReply(db, result, message);
          if (ai.called) aiCalled += 1;
          if (ai.replied) aiReplied += 1;
        } catch (error) {
          console.error('remy_instagram_auto_reply_failed', {
            conversationId: result.conversationId,
            messageId: result.messageId,
            reason: error instanceof Error ? error.message : 'unknown',
          });
        }
      }

      if (!result.duplicate && shouldAttemptInstagramAutoSale(message)) {
        try {
          const synced = await autoRegisterInstagramConversationSale(db, result.conversationId);
          if (synced.status === 'synced') ordersSynced += 1;
        } catch (error) {
          console.error('instagram_order_auto_sync_failed', {
            conversationId: result.conversationId,
            messageId: result.messageId,
            reason: error instanceof Error ? error.message : 'unknown',
          });
        }
      }
    }

    return Response.json({
      ok: true,
      stored,
      duplicates,
      ai_called: aiCalled > 0,
      ai_replied: aiReplied > 0,
      orders_synced: ordersSynced,
    });
  } catch (error) {
    console.error('instagram_webhook_persist_failed', {
      message: error instanceof Error ? error.message : 'unknown',
    });
    return Response.json({ error: 'persist_failed' }, { status: 500 });
  }
}