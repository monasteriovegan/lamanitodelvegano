import { cookies } from 'next/headers';
import { getCurrentAdminUser } from '@/lib/supabase/server-auth';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { googleCalendarConfigured, googleCalendarRedirectUri } from '@/lib/wonka/google-calendar';

export async function GET(request: Request) {
  const admin = await getCurrentAdminUser();
  if (!admin || !['admin', 'owner'].includes(admin.rol)) return Response.json({ error: 'unauthorized' }, { status: 401 });
  if (!googleCalendarConfigured()) return Response.json({ error: 'google_oauth_not_configured' }, { status: 503 });

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error');
  const store = await cookies();
  const expectedState = store.get('wonka_google_oauth_state')?.value;
  store.delete('wonka_google_oauth_state');

  if (oauthError) return Response.redirect(new URL(`/admin/wonka?calendar=error&reason=${encodeURIComponent(oauthError)}`, url.origin));
  if (!code || !state || !expectedState || state !== expectedState) {
    return Response.redirect(new URL('/admin/wonka?calendar=error&reason=invalid_state', url.origin));
  }

  const tokenBody = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    redirect_uri: googleCalendarRedirectUri(url.origin),
    grant_type: 'authorization_code',
  });
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: tokenBody,
    cache: 'no-store',
  });
  const token = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || !token?.access_token) {
    return Response.redirect(new URL(`/admin/wonka?calendar=error&reason=token_${tokenResponse.status}`, url.origin));
  }

  let email: string | null = null;
  try {
    const userInfoResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${token.access_token}` },
      cache: 'no-store',
    });
    const userInfo = await userInfoResponse.json().catch(() => ({}));
    if (userInfoResponse.ok && userInfo?.email) email = String(userInfo.email);
  } catch {}

  const db = createSupabaseServiceClient();
  const { data: existing } = await db.from('integraciones_secretas').select('google_calendar_refresh_token').eq('id', 'global').maybeSingle();
  const refreshToken = token.refresh_token ? String(token.refresh_token) : existing?.google_calendar_refresh_token || null;
  const expiresAt = new Date(Date.now() + Number(token.expires_in || 3600) * 1000).toISOString();
  const { error } = await db.from('integraciones_secretas').update({
    google_calendar_access_token: String(token.access_token),
    google_calendar_refresh_token: refreshToken,
    google_calendar_token_expires_at: expiresAt,
    google_calendar_account: email,
    updated_at: new Date().toISOString(),
  }).eq('id', 'global');
  if (error) return Response.redirect(new URL('/admin/wonka?calendar=error&reason=storage', url.origin));
  return Response.redirect(new URL('/admin/wonka?calendar=connected', url.origin));
}
