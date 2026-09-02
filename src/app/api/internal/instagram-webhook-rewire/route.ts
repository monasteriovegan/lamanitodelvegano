import { createHash, timingSafeEqual } from 'node:crypto';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { rewireInstagramWebhook } from '@/lib/meta/instagram-webhook-rewire';

export const dynamic = 'force-dynamic';

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function runRewire(request: Request) {
  const db = createSupabaseServiceClient();
  const { data: config, error } = await db
    .from('integraciones_secretas')
    .select('wa_access_token,wa_verify_token')
    .eq('id', 'global')
    .maybeSingle();
  if (error) return Response.json({ error: 'config_read_failed' }, { status: 500 });

  const url = new URL(request.url);
  const key = request.headers.get('x-instagram-rewire-key') || url.searchParams.get('key') || '';
  const secret = String(config?.wa_verify_token || process.env.META_WEBHOOK_VERIFY_TOKEN || '');
  const expected = secret ? createHash('sha256').update(secret).digest('hex') : '';
  if (!key || !expected || !safeEqual(key, expected)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!secret) return Response.json({ error: 'verify_token_missing' }, { status: 500 });

  try {
    const result = await rewireInstagramWebhook(db, {
      verifyToken: secret,
      legacyPageToken: config?.wa_access_token || null,
    });
    return Response.json(result, { status: result.ok ? 200 : 409 });
  } catch (error) {
    console.error('instagram_webhook_rewire_failed', {
      reason: error instanceof Error ? error.message : 'unknown',
    });
    return Response.json({ error: 'rewire_failed' }, { status: 500 });
  }
}

export const GET = runRewire;
export const POST = runRewire;
