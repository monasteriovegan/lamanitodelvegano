'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentAdminUser } from '@/lib/supabase/server-auth';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

/**
 * integraciones_secretas no tiene policy de RLS ni para 'authenticated',
 * así que incluso el admin autenticado no puede leerla/escribirla con el
 * cliente normal — a propósito. Aquí, después de verificar manualmente
 * que quien llama es admin, usamos el cliente de service_role SOLO para
 * esta tabla específica. Es la única excepción intencional al patrón
 * "todo pasa por RLS", y está documentada aquí mismo.
 */
export async function guardarIntegraciones(formData: FormData) {
  const admin = await getCurrentAdminUser();
  if (!admin) throw new Error('No autorizado');

  const supabase = createSupabaseServiceClient();

  const payload = {
    id: 'global',
    flow_enabled: formData.get('flow_enabled') === 'on',
    flow_sandbox: formData.get('flow_sandbox') === 'on',
    flow_api_key: (formData.get('flow_api_key') as string) || null,
    flow_secret_key: (formData.get('flow_secret_key') as string) || null,
    mp_access_token: (formData.get('mp_access_token') as string) || null,
    gemini_api_key: (formData.get('gemini_api_key') as string) || null,
    wa_access_token: (formData.get('wa_access_token') as string) || null,
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
  revalidatePath('/', 'layout'); // los IDs de analytics se leen en el layout raíz
}
