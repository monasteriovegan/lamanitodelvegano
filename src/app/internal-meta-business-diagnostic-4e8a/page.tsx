import { diagnoseMetaBusinessAssignments } from '@/lib/meta/business-diagnostic';
import { decryptMetaToken } from '@/lib/meta/token-crypto';
import { diagnoseMetaToken } from '@/lib/meta/token-diagnostic';
import { listWabaPhoneNumbers, listWabaSubscriptions } from '@/lib/meta/waba-subscription';
import { requireRole } from '@/lib/supabase/require-role';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function MetaBusinessDiagnostic() {
  await requireRole(['admin']);
  const db = createSupabaseServiceClient();
  const [{ data: config }, { data: encryptedConnections }] = await Promise.all([
    db.from('integraciones_secretas')
      .select('wa_access_token,ig_access_token').eq('id', 'global').maybeSingle(),
    db.from('meta_connections')
      .select('id,business_unit_id,status,provider,access_token_ciphertext,access_token_iv,access_token_tag')
      .eq('provider', 'meta'),
  ]);
  const token = config?.wa_access_token;
  const wabaId = process.env.META_WABA_ID;
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const graphVersion = process.env.META_GRAPH_VERSION || 'v26.0';
  if (!token || !wabaId || !appId || !appSecret) {
    return <pre>{JSON.stringify({ ok: false, reason: 'missing_server_configuration' }, null, 2)}</pre>;
  }

  const storedCandidates: Array<{
    source: string;
    storageId: string;
    token: string;
    status: string;
  }> = [{ source: 'integraciones_secretas.wa_access_token', storageId: 'global', token, status: 'active' }];
  if (config?.ig_access_token) {
    storedCandidates.push({
      source: 'integraciones_secretas.ig_access_token',
      storageId: 'global',
      token: String(config.ig_access_token),
      status: 'legacy',
    });
  }
  const encryptionKey = process.env.META_TOKEN_ENCRYPTION_KEY;
  for (const connection of encryptedConnections || []) {
    if (!encryptionKey) break;
    try {
      storedCandidates.push({
        source: 'meta_connections.encrypted_token',
        storageId: String(connection.id),
        status: String(connection.status || 'unknown'),
        token: decryptMetaToken({
          ciphertext: String(connection.access_token_ciphertext),
          iv: String(connection.access_token_iv),
          tag: String(connection.access_token_tag),
        }, encryptionKey),
      });
    } catch {
      // A failed decryption is reported below without exposing ciphertext or key material.
    }
  }

  const tokenSourceAudit = await Promise.all(storedCandidates.map(async (candidate) => ({
    source: candidate.source,
    storageId: candidate.storageId,
    status: candidate.status,
    diagnostic: await diagnoseMetaToken({
      graphVersion,
      token: candidate.token,
      appId,
      appSecret,
    }),
  })));

  const [tokenDiagnostic, businessDiagnostic, subscribedApps, phoneAssets] = await Promise.all([
    diagnoseMetaToken({ graphVersion, token, appId, appSecret }),
    diagnoseMetaBusinessAssignments({ graphVersion, wabaId, appId, token }),
    listWabaSubscriptions({ graphVersion, wabaId, token }),
    listWabaPhoneNumbers({ graphVersion, wabaId, token }),
  ]);
  return <pre>{JSON.stringify({
    ok: true,
    tokenDiagnostic,
    tokenSourceAudit,
    businessDiagnostic,
    subscribedApps,
    phoneAssets,
  }, null, 2)}</pre>;
}
