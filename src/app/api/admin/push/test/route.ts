import { NextRequest, NextResponse } from 'next/server';
import { getCurrentStrictAdminUser } from '@/lib/supabase/server-auth';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { sendAdminTestPush } from '@/lib/notifications/order-paid';
import { requireSameOrigin } from '@/lib/http/same-origin';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!requireSameOrigin(req)) return NextResponse.json({ error: 'invalid_origin' }, { status: 403 });
  const admin = await getCurrentStrictAdminUser();
  if (!admin) return NextResponse.json({ error: 'admin_required' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const endpoint = String(body?.endpoint || '').trim();
  try {
    const parsed = new URL(endpoint);
    if (parsed.protocol !== 'https:') throw new Error('invalid');
  } catch {
    return NextResponse.json({ error: 'invalid_endpoint' }, { status: 400 });
  }

  const result = await sendAdminTestPush(createSupabaseServiceClient(), admin.id, endpoint);
  if (!result.ok) {
    return NextResponse.json({ error: result.error || 'push_test_failed', status: result.status }, {
      status: result.status === 404 ? 404 : 502,
    });
  }
  return NextResponse.json({ ok: true, status: result.status });
}
