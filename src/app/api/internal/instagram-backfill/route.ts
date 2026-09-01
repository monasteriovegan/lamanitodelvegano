import { createHash, timingSafeEqual } from 'node:crypto';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { backfillInstagramConversations } from '@/lib/meta/instagram-backfill';
import { setupMetaMessaging } from '@/lib/meta/setup-messaging';

export const dynamic = 'force-dynamic';

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request: Request) {
  const db = createSupabaseServiceClient();
  const { data: config, error } = await db
    .from('integraciones_secretas')
    .select('wa_verify_token,wa_access_token')
    .eq('id', 'global')
    .maybeSingle();
  if (error) return Response.json({ error: 'config_read_failed' }, { status: 500 });

  const key = request.headers.get('x-instagram-backfill-key') || '';
  const secret = String(config?.wa_verify_token || process.env.META_WEBHOOK_VERIFY_TOKEN || '');
  const expected = secret ? createHash('sha256').update(secret).digest('hex') : '';
  if (!key || !expected || !safeEqual(key, expected)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    let setup: Awaited<ReturnType<typeof setupMetaMessaging>> | null = null;
    if (config?.wa_access_token) {
      setup = await setupMetaMessaging(String(config.wa_access_token), { verifyToken: secret });
    }
    const result = await backfillInstagramConversations(db, { limit: 50 });
    return Response.json({
      ok: true,
      webhook_rebound: Boolean(setup?.instagramAppSubscription?.ok && setup?.pageSubscription?.ok),
      setup_warnings: setup?.warnings || [],
      ...result,
    });
  } catch (error) {
    console.error('instagram_backfill_failed', {
      reason: error instanceof Error ? error.message : 'unknown',
    });
    return Response.json({ error: 'backfill_failed' }, { status: 500 });
  }
}
