import { getCurrentAdminUser } from '@/lib/supabase/server-auth';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { diagnoseMetaToken } from '@/lib/meta/token-diagnostic';
import { validateWhatsAppSystemUserToken } from '@/lib/meta/system-user-token';

export const dynamic = 'force-dynamic';

const MAIN_APP_ID = '1691394752113175';

export async function POST(request: Request) {
  const admin = await getCurrentAdminUser();
  if (!admin) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const contentType = request.headers.get('content-type') || '';
  let token = '';
  if (contentType.includes('application/json')) {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    token = typeof body?.token === 'string' ? body.token.trim() : '';
  } else {
    const form = await request.formData().catch(() => null);
    token = String(form?.get('token') || '').trim();
  }
  const appSecret = process.env.META_APP_SECRET || '';
  const appId = process.env.META_APP_ID || MAIN_APP_ID;
  if (!token || !appSecret || appId !== MAIN_APP_ID) {
    return Response.json({ error: 'configuration_invalid' }, { status: 400 });
  }

  const diagnostic = await diagnoseMetaToken({
    graphVersion: process.env.META_GRAPH_VERSION || 'v26.0',
    token,
    appId,
    appSecret,
  });
  const validation = validateWhatsAppSystemUserToken(diagnostic, MAIN_APP_ID);
  if (!validation.ok) {
    return Response.json({ error: validation.reason }, { status: 400 });
  }

  const db = createSupabaseServiceClient();
  const { error } = await db.from('integraciones_secretas')
    .update({ wa_access_token: token })
    .eq('id', 'global');
  if (error) return Response.json({ error: 'storage_failed' }, { status: 500 });

  return Response.json({
    ok: true,
    tokenType: 'SYSTEM_USER',
    appId: MAIN_APP_ID,
    systemUserId: validation.systemUserId,
    scopes: validation.scopes,
  });
}
