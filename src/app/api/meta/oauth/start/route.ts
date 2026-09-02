import { getCurrentAdminUser } from '@/lib/supabase/server-auth';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { hashOAuthState, newOAuthState } from '@/lib/meta/token-crypto';
import { INSTAGRAM_REVIEW_SCOPES, metaAuthorizationUrl } from '@/lib/meta/oauth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const user = await getCurrentAdminUser();
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const url = new URL(request.url);
  const businessUnitId = url.searchParams.get('business_unit_id');
  if (!businessUnitId) return Response.json({ error: 'business_unit_required' }, { status: 400 });

  const db = createSupabaseServiceClient();
  const { data: membership } = await db.from('business_members').select('id')
    .eq('business_unit_id', businessUnitId).eq('user_id', user.id).maybeSingle();
  if (!membership) return Response.json({ error: 'tenant_forbidden' }, { status: 403 });

  const state = newOAuthState();
  const { error } = await db.from('meta_oauth_states').insert({
    state_hash: hashOAuthState(state), user_id: user.id, business_unit_id: businessUnitId,
    requested_capabilities: [...INSTAGRAM_REVIEW_SCOPES],
    expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
  });
  if (error) return Response.json({ error: 'oauth_state_create_failed' }, { status: 500 });
  return Response.redirect(metaAuthorizationUrl(url.origin, state));
}
