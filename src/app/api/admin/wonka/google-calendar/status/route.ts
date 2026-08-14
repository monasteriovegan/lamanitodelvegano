import { getCurrentAdminUser } from '@/lib/supabase/server-auth';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { googleCalendarConfigured } from '@/lib/wonka/google-calendar';

export async function GET() {
  const admin = await getCurrentAdminUser();
  if (!admin || !['admin', 'owner'].includes(admin.rol)) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const db = createSupabaseServiceClient();
  const { data, error } = await db.from('integraciones_secretas')
    .select('google_calendar_refresh_token,google_calendar_access_token,google_calendar_token_expires_at,google_calendar_account')
    .eq('id', 'global').maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({
    oauthConfigured: googleCalendarConfigured(),
    connected: Boolean(data?.google_calendar_refresh_token || data?.google_calendar_access_token),
    account: data?.google_calendar_account || null,
    expiresAt: data?.google_calendar_token_expires_at || null,
  });
}
