'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/supabase/require-role';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

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

  // Never destroy a credential merely because exchange was not applicable.
  return token;
}

/**
 * integraciones_secretas no tiene policy de RLS ni para 'authenticated',
 * así que incluso el admin autenticado no puede leerla/escribirla con el
 * cliente normal — a propósito. Aquí, después de verificar manualmente
 * que quien llama es admin, usamos el cliente de service_role SOLO para
 * esta tabla específica.
 */
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
    // This Meta user token is shared by the official WhatsApp + Instagram
    // transport. When possible we exchange a fresh Explorer token for its
    // long-lived form before persisting it.
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

  revalidatePath('/admin/integraciones');
  revalidatePath('/', 'layout');
}
