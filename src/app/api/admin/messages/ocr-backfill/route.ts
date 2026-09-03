import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { getCurrentAdminUser } from '@/lib/supabase/server-auth';
import { runHistoricalMediaBackfill } from '@/lib/messaging/ocr';

export async function POST(request: Request) {
  const admin = await getCurrentAdminUser();
  if (!admin || !['admin', 'soporte', 'owner', 'supervisor'].includes(admin.rol)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const limit = Math.max(1, Math.min(100, Number(body.limit || 50)));
  const days = Math.max(1, Math.min(365, Number(body.days || 90)));

  const db = createSupabaseServiceClient();
  try {
    const result = await runHistoricalMediaBackfill(db, { limit, days });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('ocr_backfill_api_failed', { error: errorMsg });
    return NextResponse.json({ ok: false, error: errorMsg }, { status: 500 });
  }
}
