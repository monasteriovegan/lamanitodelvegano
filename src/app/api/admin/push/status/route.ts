import { NextResponse } from 'next/server';
import { getCurrentStrictAdminUser } from '@/lib/supabase/server-auth';
import { getWebPushVapidConfig } from '@/lib/notifications/web-push-sender';

export const dynamic = 'force-dynamic';

export async function GET() {
  const admin = await getCurrentStrictAdminUser();
  if (!admin) return NextResponse.json({ error: 'admin_required' }, { status: 403 });
  const vapid = getWebPushVapidConfig();
  return NextResponse.json({
    configured: Boolean(vapid),
    publicKey: vapid?.publicKey || null,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
