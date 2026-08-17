'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/supabase/require-role';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { setupMetaMessaging } from '@/lib/meta/setup-messaging';

const META_APP_ID = '1691394752113175';
const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';

function submittedSecret(formData: FormData, name: string) {
  return String(formData.get(name) || '').trim();
}

async function validateGroqKey(apiKey: string) {
  const response = await fetch(`${GROQ_BASE_URL}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`groq_key_invalid:${response.status}`);
}

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
  const [{ data: current }, { data: currentGroq }] = await Promise.all([
    supabase.from('integraciones_secretas').select('*').eq('id', 'global').maybeSingle(),
    supabase.from('ai_provider_credentials').select('provider,api_key,base_url,enabled').eq('provider', 'groq').maybeSingle(),
  ]);

  const newGroqKey = submittedSecret(formData, 'groq_api_key');
  if (newGroqKey) await validateGroqKey(newGroqKey);

  const newMetaToken = submittedSecret(formData, 'wa_access_token');
  const durableMetaToken = newMetaToken
    ? await tryExchangeMetaToken(newMetaToken)
    : current?.wa_access_token || null;
  const verifyToken = submittedSecret(formData, 'wa_verify_token') || current?.wa_verify_token || null;

  const payload = {
    id: 'global',
    flow_enabled: formData.get('flow_enabled') === 'on',
    flow_sandbox: formData.get('flow_sandbox') === 'on',
    flow_api_key: submittedSecret(formData, 'flow_api_key') || current?.flow_api_key || null,
    flow_secret_key: submittedSecret(formData, 'flow_secret_key') || current?.flow_secret_key || null,
    mp_access_token: submittedSecret(formData, 'mp_access_token') || current?.mp_access_token || null,
    gemini_api_key: submittedSecret(formData, 'gemini_api_key') || current?.gemini_api_key || null,
    wa_access_token: durableMetaToken,
    wa_verify_token: verifyToken,
    wa_phone_number_id: String(formData.get('wa_phone_number_id') || '').trim() || current?.wa_phone_number_id || null,
    resend_api_key: submittedSecret(formData, 'resend_api_key') || current?.resend_api_key || null,
    resend_from_email: String(formData.get('resend_from_email') || '').trim() || current?.resend_from_email || null,
    meta_pixel_id: String(formData.get('meta_pixel_id') || '').trim() || current?.meta_pixel_id || null,
    ga4_measurement_id: String(formData.get('ga4_measurement_id') || '').trim() || current?.ga4_measurement_id || null,
  };

  const { error } = await supabase.from('integraciones_secretas').upsert(payload);
  if (error) throw new Error(error.message);

  const groqKey = newGroqKey || currentGroq?.api_key || '';
  if (groqKey) {
    const { error: groqError } = await supabase.from('ai_provider_credentials').upsert({
      provider: 'groq',
      api_key: groqKey,
      base_url: GROQ_BASE_URL,
      enabled: formData.get('groq_enabled') === 'on',
      metadata: { compatible_api: 'openai_chat_completions' },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'provider' });
    if (groqError) throw new Error(groqError.message);
  }

  if (newMetaToken && durableMetaToken) {
    try {
      const setup = await setupMetaMessaging(durableMetaToken, { verifyToken });
      console.info('meta_messaging_setup', {
        ok: setup.ok,
        tokenValid: setup.tokenValid,
        instagramAppSubscription: setup.instagramAppSubscription?.ok ?? false,
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
  revalidatePath('/admin/agentes');
  revalidatePath('/admin/conversaciones');
  revalidatePath('/', 'layout');
}
