import { getCurrentAdminUser } from '@/lib/supabase/server-auth';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { checkMetaToken, subscribeMetaPages } from '@/lib/meta/oauth';
import { decryptMetaToken } from '@/lib/meta/token-crypto';
import { metaReconnectFailureCode, metaReconnectReadOnly } from '@/lib/meta/reconnect-policy';

export async function POST(request: Request) {
  const user = await getCurrentAdminUser();
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const connectionId = String(body.connectionId || '');
  const assetIds = Array.isArray(body.assetIds) ? [...new Set(body.assetIds.map(String))] : [];
  if (!connectionId || !assetIds.length) return Response.json({ error: 'selection_required' }, { status: 400 });

  const db = createSupabaseServiceClient();
  const { data: connection } = await db.from('meta_connections').select('id,business_unit_id,provider,status')
    .eq('id', connectionId).in('status', ['pending', 'active', 'degraded', 'expired']).maybeSingle();
  if (!connection) return Response.json({ error: 'connection_not_found' }, { status: 404 });
  const { data: membership } = await db.from('business_members').select('id')
    .eq('business_unit_id', connection.business_unit_id).eq('user_id', user.id).maybeSingle();
  if (!membership) return Response.json({ error: 'tenant_forbidden' }, { status: 403 });
  const connectionBusinessUnitId = connection.business_unit_id;

  const { data: candidates } = await db.from('meta_connection_assets').select('id,asset_type,external_id,metadata')
    .eq('connection_id', connectionId).eq('business_unit_id', connection.business_unit_id).in('id', assetIds);
  const candidateIds = new Set((candidates || []).map((candidate) => String(candidate.id)));
  if (candidateIds.size !== assetIds.length) return Response.json({ error: 'invalid_asset_selection' }, { status: 400 });

  const { error: clearError } = await db.from('meta_connection_assets').update({ selected: false })
    .eq('connection_id', connectionId).eq('business_unit_id', connection.business_unit_id);
  if (clearError) return Response.json({ error: 'selection_failed' }, { status: 500 });
  const { error: selectError } = await db.from('meta_connection_assets').update({ selected: true })
    .eq('connection_id', connectionId).eq('business_unit_id', connection.business_unit_id).in('id', assetIds);
  if (selectError) return Response.json({ error: 'selection_failed' }, { status: 500 });
  const { data: secret } = await db.from('meta_connections')
    .select('access_token_ciphertext,access_token_iv,access_token_tag').eq('id', connectionId)
    .eq('business_unit_id', connection.business_unit_id).single();
  const key = process.env.META_TOKEN_ENCRYPTION_KEY;
  if (!secret || !key) return Response.json({ error: 'health_configuration_missing' }, { status: 503 });
  async function markDegraded(stage: 'decrypt' | 'health' | 'subscribe') {
    const code = metaReconnectFailureCode(stage);
    await db.from('meta_connections').update({ status: 'degraded', last_error_code: code })
      .eq('id', connectionId).eq('business_unit_id', connectionBusinessUnitId);
    return Response.json({ error: code }, { status: 409 });
  }

  let accessToken: string;
  try {
    accessToken = decryptMetaToken({ ciphertext: secret.access_token_ciphertext, iv: secret.access_token_iv, tag: secret.access_token_tag }, key);
  } catch {
    return markDegraded('decrypt');
  }
  try {
    if (!(await checkMetaToken(accessToken))) return markDegraded('health');
  } catch {
    return markDegraded('health');
  }

  const readOnly = metaReconnectReadOnly(process.env);
  if (!readOnly) {
    try {
      const pageIds = (candidates || []).flatMap((candidate) => {
        if (candidate.asset_type === 'page') return [String(candidate.external_id)];
        if (candidate.asset_type === 'instagram_account' && candidate.metadata?.page_id) {
          return [String(candidate.metadata.page_id)];
        }
        return [];
      });
      await subscribeMetaPages(accessToken, pageIds);
    } catch {
      return markDegraded('subscribe');
    }
  }
  await db.from('meta_connection_assets').update({ subscribed: !readOnly })
    .eq('connection_id', connectionId).eq('business_unit_id', connection.business_unit_id).in('id', assetIds);
  await db.from('meta_connections').update({ status: 'active', last_health_at: new Date().toISOString(), last_error_code: null })
    .eq('id', connectionId).eq('business_unit_id', connection.business_unit_id);
  await db.from('meta_connections').update({ status: 'revoked', last_error_code: 'reauthorized' })
    .eq('business_unit_id', connection.business_unit_id).eq('provider', connection.provider)
    .eq('status', 'active').neq('id', connectionId);
  return Response.json({ ok: true, mode: metaReconnectReadOnly(process.env) ? 'read_only' : 'live' });
}
