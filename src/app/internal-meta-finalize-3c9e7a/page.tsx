import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { setupMetaMessaging } from '@/lib/meta/setup-messaging';

export const dynamic = 'force-dynamic';

export default async function MetaFinalizeProbe() {
  const db = createSupabaseServiceClient();
  const { data: config } = await db
    .from('integraciones_secretas')
    .select('wa_access_token,wa_verify_token')
    .eq('id', 'global')
    .maybeSingle();

  if (!config?.wa_access_token || !config?.wa_verify_token) {
    return <pre>{JSON.stringify({ ok: false, reason: 'missing_config' })}</pre>;
  }

  const result = await setupMetaMessaging(config.wa_access_token, { verifyToken: config.wa_verify_token });
  return (
    <pre>{JSON.stringify({
      instagramCallback: result.instagramAppSubscription,
      tokenValid: result.tokenValid,
      pageSubscription: result.pageSubscription?.ok ?? false,
      wabaSubscription: result.wabaSubscription?.ok ?? false,
    }, null, 2)}</pre>
  );
}
