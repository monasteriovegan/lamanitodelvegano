import { createHash, timingSafeEqual } from 'node:crypto';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { reconcilePendingSales } from '@/lib/orders/reconcile-pending-sales';

export const dynamic = 'force-dynamic';

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function boundedInt(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(Math.trunc(parsed), max));
}

async function run(request: Request) {
  const db = createSupabaseServiceClient();
  const { data: config, error: configError } = await db
    .from('integraciones_secretas')
    .select('wa_verify_token')
    .eq('id', 'global')
    .maybeSingle();
  if (configError) return Response.json({ error: 'config_read_failed' }, { status: 500 });

  const url = new URL(request.url);
  const key = request.headers.get('x-order-reconcile-key') || url.searchParams.get('key') || '';
  const secret = String(config?.wa_verify_token || process.env.META_WEBHOOK_VERIFY_TOKEN || '');
  const expected = secret ? createHash('sha256').update(secret).digest('hex') : '';
  if (!key || !expected || !safeEqual(key, expected)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const limit = boundedInt(url.searchParams.get('limit'), 50, 1, 100);
  const hours = boundedInt(url.searchParams.get('hours'), 72, 1, 168);

  try {
    const result = await reconcilePendingSales(db, { limit, hours });
    return Response.json({ ok: true, limit, hours, ...result });
  } catch (error) {
    console.error('pending_sale_reconciliation_failed', {
      reason: error instanceof Error ? error.message : 'unknown',
    });
    return Response.json({ error: 'reconcile_failed' }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;