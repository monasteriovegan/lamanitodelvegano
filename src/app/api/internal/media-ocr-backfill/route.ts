import { createHash, timingSafeEqual } from 'node:crypto';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { runHistoricalMediaBackfillV2 } from '@/lib/messaging/historical-media-backfill';

export const dynamic = 'force-dynamic';

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function run(request: Request) {
  const db = createSupabaseServiceClient();
  const { data: config, error } = await db
    .from('integraciones_secretas')
    .select('wa_verify_token')
    .eq('id', 'global')
    .maybeSingle();
  if (error) return Response.json({ error: 'config_read_failed' }, { status: 500 });

  const url = new URL(request.url);
  const key = request.headers.get('x-media-backfill-key') || url.searchParams.get('key') || '';
  const secret = String(config?.wa_verify_token || process.env.META_WEBHOOK_VERIFY_TOKEN || '');
  const expected = secret ? createHash('sha256').update(secret).digest('hex') : '';
  if (!key || !expected || !safeEqual(key, expected)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const rawLimit = Number(url.searchParams.get('limit') || 30);
  const rawDays = Number(url.searchParams.get('days') || 14);
  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(Math.trunc(rawLimit), 100)) : 30;
  const days = Number.isFinite(rawDays) ? Math.max(1, Math.min(Math.trunc(rawDays), 365)) : 14;

  try {
    const result = await runHistoricalMediaBackfillV2(db, { limit, days });
    return Response.json({ ok: true, limit, days, ...result });
  } catch (err) {
    console.error('historical_media_backfill_failed', {
      reason: err instanceof Error ? err.message : 'unknown',
    });
    return Response.json({ error: 'media_backfill_failed' }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
