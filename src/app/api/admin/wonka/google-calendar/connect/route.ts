import { randomBytes } from 'crypto';
import { cookies } from 'next/headers';
import { getCurrentAdminUser } from '@/lib/supabase/server-auth';
import { googleCalendarConfigured, googleCalendarRedirectUri } from '@/lib/wonka/google-calendar';

export async function GET(request: Request) {
  const admin = await getCurrentAdminUser();
  if (!admin || !['admin', 'owner'].includes(admin.rol)) return Response.json({ error: 'unauthorized' }, { status: 401 });
  if (!googleCalendarConfigured()) {
    return Response.json({ error: 'google_oauth_not_configured', message: 'Faltan GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en Vercel.' }, { status: 503 });
  }

  const origin = new URL(request.url).origin;
  const state = randomBytes(24).toString('hex');
  const store = await cookies();
  store.set('wonka_google_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 10 * 60,
  });

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID!);
  url.searchParams.set('redirect_uri', googleCalendarRedirectUri(origin));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('include_granted_scopes', 'true');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('state', state);
  url.searchParams.set('scope', [
    'openid',
    'email',
    'https://www.googleapis.com/auth/calendar.events',
  ].join(' '));

  return Response.redirect(url);
}
