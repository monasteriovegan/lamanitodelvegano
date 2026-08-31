import { diagnoseMetaBusinessAssignments } from '@/lib/meta/business-diagnostic';
import { diagnoseMetaToken } from '@/lib/meta/token-diagnostic';
import { listWabaPhoneNumbers, listWabaSubscriptions } from '@/lib/meta/waba-subscription';
import { requireRole } from '@/lib/supabase/require-role';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function MetaBusinessDiagnostic() {
  await requireRole(['admin']);
  const db = createSupabaseServiceClient();
  const { data: config } = await db.from('integraciones_secretas')
    .select('wa_access_token').eq('id', 'global').maybeSingle();
  const token = config?.wa_access_token;
  const wabaId = process.env.META_WABA_ID;
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const graphVersion = process.env.META_GRAPH_VERSION || 'v26.0';
  if (!token || !wabaId || !appId || !appSecret) {
    return <pre>{JSON.stringify({ ok: false, reason: 'missing_server_configuration' }, null, 2)}</pre>;
  }

  const [tokenDiagnostic, businessDiagnostic, subscribedApps, phoneAssets] = await Promise.all([
    diagnoseMetaToken({ graphVersion, token, appId, appSecret }),
    diagnoseMetaBusinessAssignments({ graphVersion, wabaId, appId, token }),
    listWabaSubscriptions({ graphVersion, wabaId, token }),
    listWabaPhoneNumbers({ graphVersion, wabaId, token }),
  ]);
  return <pre>{JSON.stringify({
    ok: true,
    tokenDiagnostic,
    businessDiagnostic,
    subscribedApps,
    phoneAssets,
  }, null, 2)}</pre>;
}
