import { createSupabaseServiceClient } from '@/lib/supabase/server';

/**
 * Cliente de WhatsApp Cloud API (Meta). Las credenciales viven en
 * integraciones_secretas (configurables desde /admin/integraciones), no en
 * variables de entorno — mismo patrón que Flow, Mercado Pago y Gemini.
 *
 * No se pudo probar contra la API real de Meta en el entorno donde se
 * escribió este código (sin salida de red hacia graph.facebook.com).
 * Verifica el número de versión de la API (`v21.0`) contra la documentación
 * vigente antes de depender de esto en producción — Meta las retira
 * periódicamente.
 */
type EnviarResultado = { ok: true } | { ok: false; error: string };

export async function enviarMensajeWhatsApp(telefono: string, mensaje: string): Promise<EnviarResultado> {
  const supabase = createSupabaseServiceClient();
  const { data: config } = await supabase
    .from('integraciones_secretas')
    .select('wa_access_token, wa_phone_number_id')
    .eq('id', 'global')
    .maybeSingle();

  const token = config?.wa_access_token;
  const phoneNumberId = config?.wa_phone_number_id;

  if (!token || !phoneNumberId) {
    return { ok: false, error: 'WhatsApp no está configurado (falta token o phone_number_id en /admin/integraciones).' };
  }

  const telefonoLimpio = normalizarTelefonoChile(telefono);

  try {
    const response = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: telefonoLimpio,
        type: 'text',
        text: { body: mensaje, preview_url: false },
      }),
    });

    if (!response.ok) {
      const detalle = await response.text();
      return { ok: false, error: `WhatsApp respondió ${response.status}: ${detalle}` };
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Error desconocido enviando WhatsApp.' };
  }
}

/**
 * WhatsApp Cloud API espera el número en formato E.164 sin "+" (ej.
 * 56912345678). Los clientes suelen escribir "+56 9 1234 5678", "912345678",
 * etc. — esto intenta normalizar los casos más comunes para Chile.
 */
export function normalizarTelefonoChile(telefono: string): string {
  const soloDigitos = telefono.replace(/\D/g, '');
  if (soloDigitos.startsWith('56')) return soloDigitos;
  if (soloDigitos.startsWith('9') && soloDigitos.length === 9) return `56${soloDigitos}`;
  return soloDigitos;
}
