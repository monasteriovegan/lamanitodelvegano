import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { enviarMensajeWhatsApp } from '@/lib/whatsapp/client';
import { generarRespuestaWhatsApp } from '@/lib/whatsapp/asistente';

export const dynamic = 'force-dynamic';

/**
 * Verificación del webhook (obligatoria por Meta al configurar la
 * suscripción en el panel de WhatsApp Business). Meta llama a esta URL con
 * hub.mode=subscribe, hub.verify_token y hub.challenge — hay que devolver
 * el challenge tal cual si el verify_token coincide con el configurado en
 * /admin/integraciones.
 *
 * URL a configurar en Meta: https://tu-dominio.cl/api/whatsapp
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const supabase = createSupabaseServiceClient();
  const { data: config } = await supabase
    .from('integraciones_secretas')
    .select('wa_verify_token')
    .eq('id', 'global')
    .maybeSingle();

  if (mode === 'subscribe' && token && config?.wa_verify_token && token === config.wa_verify_token) {
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse('Verificación fallida', { status: 403 });
}

/**
 * Recepción de mensajes entrantes. Estructura del payload según la
 * documentación de WhatsApp Cloud API (verificar formato exacto vigente
 * antes de depender de esto en producción — no se pudo probar contra un
 * webhook real de Meta en este entorno).
 *
 * Comportamiento:
 *  - Si el mensaje menciona un número de pedido o palabras de seguimiento,
 *    responde con instrucciones para rastrearlo.
 *  - Si no, responde con el asistente de Gemini (respuesta breve genérica).
 *  - Todo el manejo de errores es silencioso hacia Meta: siempre se
 *    devuelve 200, porque si no, Meta reintenta el mismo webhook muchas
 *    veces seguidas.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const entry = body?.entry?.[0];
    const change = entry?.changes?.[0];
    const mensaje = change?.value?.messages?.[0];

    if (!mensaje) {
      // Eventos que no son mensajes de texto entrantes (confirmaciones de
      // lectura, estados de entrega, etc.) — no hay nada que responder.
      return NextResponse.json({ ok: true });
    }

    const telefono: string = mensaje.from;
    const texto: string = mensaje.text?.body || '';

    if (!telefono || !texto) {
      return NextResponse.json({ ok: true });
    }

    const respuesta = await generarRespuestaWhatsApp(texto);
    const envio = await enviarMensajeWhatsApp(telefono, respuesta);

    if (!envio.ok) {
      console.error('No se pudo responder por WhatsApp:', envio.error);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Error procesando webhook de WhatsApp:', err);
    // Igual 200 — ver comentario arriba sobre reintentos de Meta.
    return NextResponse.json({ ok: true });
  }
}
