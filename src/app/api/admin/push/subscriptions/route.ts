import { NextRequest, NextResponse } from 'next/server';
import { getCurrentStrictAdminUser } from '@/lib/supabase/server-auth';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { validateBrowserPushSubscription } from '@/lib/notifications/web-push';
import { requireSameOrigin } from '@/lib/http/same-origin';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!requireSameOrigin(req)) return NextResponse.json({ error: 'invalid_origin' }, { status: 403 });
  const admin = await getCurrentStrictAdminUser();
  if (!admin) return NextResponse.json({ error: 'admin_required' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const subscription = validateBrowserPushSubscription(body?.subscription);
  if (!subscription) return NextResponse.json({ error: 'invalid_subscription' }, { status: 400 });

  const db = createSupabaseServiceClient();
  const { data: existing, error: existingError } = await db.from('admin_push_subscriptions')
    .select('user_id')
    .eq('endpoint', subscription.endpoint)
    .maybeSingle();
  if (existingError) return NextResponse.json({ error: 'subscription_lookup_failed' }, { status: 500 });
  if (existing && String(existing.user_id) !== admin.id) {
    return NextResponse.json({ error: 'endpoint_owned_by_another_user' }, { status: 409 });
  }

  const now = new Date().toISOString();
  const { error } = await db.from('admin_push_subscriptions').upsert({
    user_id: admin.id,
    endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh,
    auth: subscription.keys.auth,
    device_name: String(body?.deviceName || '').trim().slice(0, 120) || null,
    user_agent: String(req.headers.get('user-agent') || '').slice(0, 500) || null,
    enabled: true,
    updated_at: now,
    last_failure_reason: null,
  }, { onConflict: 'endpoint' });
  if (error) {
    console.error('admin_push_subscription_save_failed', { userId: admin.id, code: (error as any).code });
    return NextResponse.json({ error: 'subscription_save_failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
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

  const db = createSupabaseServiceClient();
  const { error } = await db.from('admin_push_subscriptions').update({
    enabled: false,
    updated_at: new Date().toISOString(),
  }).eq('user_id', admin.id).eq('endpoint', endpoint);
  if (error) return NextResponse.json({ error: 'subscription_disable_failed' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
