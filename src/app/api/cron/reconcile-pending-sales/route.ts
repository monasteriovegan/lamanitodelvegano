import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { reconcilePendingSales } from '@/lib/orders/reconcile-pending-sales';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get('authorization');

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
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
