import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { runOpportunityCycle } from '@/lib/opportunities/runner';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const result = await runOpportunityCycle(createSupabaseServiceClient(), new Date());
    return NextResponse.json({ ok: true, ...result, mode: process.env.SALES_OPPORTUNITY_AUTO_SEND === 'true' ? 'automatic' : 'observation' });
  } catch (error) {
    console.error('sales_opportunity_cron_failed', {
      reason: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json({ error: 'opportunity_cycle_failed' }, { status: 500 });
  }
}
