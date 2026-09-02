import { createHash, timingSafeEqual } from 'node:crypto';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { backfillInstagramConversations } from '@/lib/meta/instagram-backfill';

export const dynamic = 'force-dynamic';

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function runBackfill(request: Request) {
  const db = createSupabaseServiceClient();
  const { data: config, error } = await db
    .from('integraciones_secretas')
    .select('wa_verify_token')
    .eq('id', 'global')
    .maybeSingle();
  if (error) return Response.json({ error: 'config_read_failed' }, { status: 500 });

  const url = new URL(request.url);
  const key = request.headers.get('x-instagram-backfill-key') || url.searchParams.get('key') || '';
  const secret = String(config?.wa_verify_token || process.env.META_WEBHOOK_VERIFY_TOKEN || '');
  const expected = secret ? createHash('sha256').update(secret).digest('hex') : '';
  if (!key || !expected || !safeEqual(key, expected)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const userId = url.searchParams.get('user_id') || undefined;
  if (userId && !/^\d+$/.test(userId)) {
    return Response.json({ error: 'invalid_user_id' }, { status: 400 });
  }

  try {
    const result = await backfillInstagramConversations(db, {
      limit: 3,
      ...(userId ? { userId } : {}),
    });
    return Response.json({ ok: true, ...result });
  } catch (error) {
    console.error('instagram_backfill_failed', {
      reason: error instanceof Error ? error.message : 'unknown',
    });
    return Response.json({ error: 'backfill_failed' }, { status: 500 });
  }
}

export const GET = runBackfill;
export const POST = runBackfill;
