import { createHash, timingSafeEqual } from 'node:crypto';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { autoRegisterInstagramConversationSale } from '@/lib/orders/instagram-auto-sale';
import { autoRegisterWhatsappConversationSale } from '@/lib/orders/whatsapp-auto-sale';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function runReconcile(request: Request) {
  const db = createSupabaseServiceClient();
  const { data: config, error: configError } = await db
    .from('integraciones_secretas')
    .select('wa_verify_token')
    .eq('id', 'global')
    .maybeSingle();
  if (configError) return Response.json({ error: 'config_read_failed' }, { status: 500 });

  const url = new URL(request.url);
  const key = request.headers.get('x-conversation-reconcile-key') || url.searchParams.get('key') || '';
  const secret = String(config?.wa_verify_token || process.env.META_WEBHOOK_VERIFY_TOKEN || '');
  const expected = secret ? createHash('sha256').update(secret).digest('hex') : '';
  if (!key || !expected || !safeEqual(key, expected)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const conversationId = url.searchParams.get('conversation_id') || '';
  if (!UUID_RE.test(conversationId)) {
    return Response.json({ error: 'invalid_conversation_id' }, { status: 400 });
  }

  const { data: conversation, error } = await db
    .from('conversations')
    .select('id,channel')
    .eq('id', conversationId)
    .maybeSingle();
  if (error) return Response.json({ error: 'conversation_read_failed' }, { status: 500 });
  if (!conversation) return Response.json({ error: 'conversation_not_found' }, { status: 404 });

  try {
    const result = conversation.channel === 'instagram'
      ? await autoRegisterInstagramConversationSale(db, conversationId)
      : conversation.channel === 'whatsapp'
        ? await autoRegisterWhatsappConversationSale(db, conversationId)
        : null;

    if (!result) return Response.json({ error: 'unsupported_channel' }, { status: 400 });
    return Response.json({ ok: true, channel: conversation.channel, conversationId, ...result });
  } catch (error) {
    console.error('conversation_sale_reconcile_failed', {
      conversationId,
      channel: conversation.channel,
      reason: error instanceof Error ? error.message : 'unknown',
    });
    return Response.json({ error: 'reconcile_failed' }, { status: 500 });
  }
}

export const GET = runReconcile;
export const POST = runReconcile;
