import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { reconcilePendingSales } from '@/lib/orders/reconcile-pending-sales';
import { hasValidCronAuthorization } from '@/lib/security/cron-authorization';
import { scheduledJobEnabled } from '@/lib/runtime/production-controls';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');

  if (!hasValidCronAuthorization(authHeader, secret)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  if (!scheduledJobEnabled('reconcile')) {
    return NextResponse.json({ ok: false, paused: true }, { status: 503, headers: { 'Retry-After': '3600' } });
  }

  try {
    const db = createSupabaseServiceClient();
    const result = await reconcilePendingSales(db, { limit: 10, hours: 72 });
    console.info('order_reconciliation_cron_complete', {
      scanned: result.scanned,
      synced: result.synced,
      pending: result.pending,
      failed: result.failed,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('order_reconciliation_cron_failed', {
      reason: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json({ error: 'reconcile_failed' }, { status: 500 });
  }
}
