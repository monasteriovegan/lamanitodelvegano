import { ensureWabaMessagesSubscription, listWabaSubscriptions } from '@/lib/meta/waba-subscription';
import { diagnoseMetaToken } from '@/lib/meta/token-diagnostic';
import { requireRole } from '@/lib/supabase/require-role';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function WhatsAppSubscriptionFinalizer() {
  await requireRole(['admin']);
  const db = createSupabaseServiceClient();
  const { data: config } = await db
    .from('integraciones_secretas')
    .select('wa_access_token')
    .eq('id', 'global')
    .maybeSingle();

  const wabaId = process.env.META_WABA_ID;
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!config?.wa_access_token || !wabaId || !appId || !appSecret) {
    return <pre>{JSON.stringify({ ok: false, reason: 'missing_server_configuration' }, null, 2)}</pre>;
  }

  const result = await ensureWabaMessagesSubscription({
    graphVersion: process.env.META_GRAPH_VERSION || 'v26.0',
    wabaId,
    appId,
    token: config.wa_access_token,
  });
  const observedSubscriptions = await listWabaSubscriptions({
    graphVersion: process.env.META_GRAPH_VERSION || 'v26.0',
    wabaId,
    token: config.wa_access_token,
  });
  const tokenDiagnostic = await diagnoseMetaToken({
    graphVersion: process.env.META_GRAPH_VERSION || 'v26.0',
    token: config.wa_access_token,
    appId,
    appSecret,
  });
  return <pre>{JSON.stringify({
    ok: result.after.status === 'subscribed' && result.after.fields.includes('messages'),
    before: result.before,
    mutationStatus: result.mutationStatus,
    after: result.after,
    observedSubscriptions,
    tokenDiagnostic,
  }, null, 2)}</pre>;
}
