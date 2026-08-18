import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/supabase/require-role';
import { setupMetaMessaging } from '@/lib/meta/setup-messaging';

export const dynamic = 'force-dynamic';

export default async function MetaFinalizeCheck() {
  await requireRole(['admin']);
  const db = createSupabaseServiceClient();
  const { data: config } = await db
    .from('integraciones_secretas')
    .select('wa_access_token,wa_verify_token')
    .eq('id', 'global')
    .maybeSingle();

  if (!config?.wa_access_token || !config?.wa_verify_token) {
    return <pre>{JSON.stringify({ ok: false, reason: 'missing_config' }, null, 2)}</pre>;
  }

  try {
    const result = await setupMetaMessaging(config.wa_access_token, { verifyToken: config.wa_verify_token });
    return <pre>{JSON.stringify({
      ok: result.ok,
      tokenValid: result.tokenValid,
      permissions: result.permissions,
      page: result.page,
      pageSubscription: result.pageSubscription,
      wabaSubscription: result.wabaSubscription,
      instagramAppSubscription: result.instagramAppSubscription,
      warnings: result.warnings,
    }, null, 2)}</pre>;
  } catch (error) {
    return <pre>{JSON.stringify({ ok: false, reason: 'exception', message: error instanceof Error ? error.message : 'unknown' }, null, 2)}</pre>;
  }
}
