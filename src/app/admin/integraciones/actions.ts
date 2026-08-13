'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/supabase/require-role';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { setupMetaMessaging } from '@/lib/meta/setup-messaging';

const META_APP_ID = '1691394752113175';

async function tryExchangeMetaToken(token: string | null) {
  if (!token || !process.env.META_APP_SECRET) return token;

  try {
    const version = process.env.META_GRAPH_VERSION || 'v26.0';
    const url = new URL(`https://graph.facebook.com/${version}/oauth/access_token`);
    url.searchParams.set('grant_type', 'fb_exchange_token');
    url.searchParams.set('client_id', process.env.META_APP_ID || META_APP_ID);
    url.searchParams.set('client_secret', process.env.META_APP_SECRET);
    url.searchParams.set('fb_exchange_token', token);

    const response = await fetch(url, { cache: 'no-store' });
    const body = await response.json().catch(() => ({}));
    if (response.ok && body?.access_token) return String(body.access_token);
  } catch (error) {
    console.warn('meta_token_exchange_failed', {
      message: error instanceof Error ? error.message : 'unknown',
    });
  }

  return token;
}

export async function guardarIntegraciones(formData: FormData) {
  await requireRole(['admin']);

  const supabase = createSupabaseServiceClient();
  const submittedMetaToken = (formData.get('wa_access_token') as string) || null;
  const durableMetaToken = await tryExchangeMetaToken(submittedMetaToken);

  const payload = {
    id: 'global',
    flow_enabled: formData.get('flow_enabled') === 'on',
    flow_sandbox: formData.get('flow_sandbox') === 'on',
    flow_api_key: (formData.get('flow_api_key') as string) || null,
    flow_secret_key: (formData.get('flow_secret_key') as string) || null,
    mp_access_token: (formData.get('mp_access_token') as string) || null,
    gemini_api_key: (formData.get('gemini_api_key') as string) || null,
    wa_access_token: durableMetaToken,
    wa_verify_token: (formData.get('wa_verify_token') as string) || null,
    wa_phone_number_id: (formData.get('wa_phone_number_id') as string) || null,
    resend_api_key: (formData.get('resend_api_key') as string) || null,
    resend_from_email: (formData.get('resend_from_email') as string) || null,
    meta_pixel_id: (formData.get('meta_pixel_id') as string) || null,
    ga4_measurement_id: (formData.get('ga4_measurement_id') as string) || null,
  };

  const { error } = await supabase.from('integraciones_secretas').upsert(payload);
  if (error) throw new Error(error.message);

  // Credential save should never fail merely because Meta is temporarily
  // unavailable. Configure/verify both messaging assets best-effort and log
  // only non-secret status information.
  if (durableMetaToken) {
    try {
      const setup = await setupMetaMessaging(durableMetaToken);
      console.info('meta_messaging_setup', {
        ok: setup.ok,
        tokenValid: setup.tokenValid,
        pageSubscription: setup.pageSubscription?.ok ?? false,
        wabaSubscription: setup.wabaSubscription?.ok ?? false,
        warnings: setup.warnings,
      });
    } catch (setupError) {
      console.warn('meta_messaging_setup_failed', {
        message: setupError instanceof Error ? setupError.message : 'unknown',
      });
    }
  }

  revalidatePath('/admin/integraciones');
  revalidatePath('/admin/conversaciones');
  revalidatePath('/', 'layout');
}
