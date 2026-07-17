import { createSupabaseServiceClient } from '@/lib/supabase/server';

/**
 * Cliente de Resend (https://resend.com) vía su API REST directa, sin
 * instalar el SDK oficial — evita una dependencia más y Resend expone todo
 * lo necesario por REST. Credenciales en integraciones_secretas, mismo
 * patrón que Flow/Mercado Pago/Gemini/WhatsApp.
 *
 * No se pudo probar contra la API real de Resend en este entorno (sin
 * salida de red hacia api.resend.com).
 *
 * Requiere haber verificado un dominio propio en Resend para el campo
 * `resend_from_email` (ej. "pedidos@lamanitodelvegano.cl") — con el dominio
 * de prueba de Resend los emails no llegan de forma confiable a todos los
 * proveedores.
 */
type EnviarResultado = { ok: true } | { ok: false; error: string };

export async function enviarEmail(opts: { to: string; subject: string; html: string }): Promise<EnviarResultado> {
  const supabase = createSupabaseServiceClient();
  const { data: config } = await supabase
    .from('integraciones_secretas')
    .select('resend_api_key, resend_from_email')
    .eq('id', 'global')
    .maybeSingle();

  const apiKey = config?.resend_api_key;
  const from = config?.resend_from_email;

  if (!apiKey || !from) {
    return { ok: false, error: 'Resend no está configurado (falta API key o email remitente en /admin/integraciones).' };
  }

  if (!opts.to) {
    return { ok: false, error: 'El pedido no tiene email de contacto — no se envía.' };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `La Manito Del Vegano <${from}>`,
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
      }),
    });

    if (!response.ok) {
      const detalle = await response.text();
      return { ok: false, error: `Resend respondió ${response.status}: ${detalle}` };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error desconocido enviando email.' };
  }
}
