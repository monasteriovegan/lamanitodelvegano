import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

/**
 * Webhook que Flow llama cuando el estado de un pago cambia.
 * A diferencia del sitio viejo, aquí SIEMPRE se verifica la firma de Flow
 * antes de confiar en el resultado, y se usa la nueva tabla integraciones_secretas
 * en vez de leer credenciales desde `ajustes` (que tenía lectura pública).
 */
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const token = formData.get('token') as string | null;

  if (!token) {
    return NextResponse.json({ error: 'Falta el token de pago.' }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();

  const { data: integraciones } = await supabase
    .from('integraciones_secretas')
    .select('flow_api_key, flow_secret_key, flow_sandbox')
    .eq('id', 'global')
    .maybeSingle();

  if (!integraciones?.flow_api_key || !integraciones.flow_secret_key) {
    return NextResponse.json({ error: 'Flow no configurado.' }, { status: 500 });
  }

  const params: Record<string, string> = { apiKey: integraciones.flow_api_key.trim(), token };
  const keysOrdenadas = Object.keys(params).sort();
  const toSign = keysOrdenadas.map((k) => k + params[k]).join('');
  const signature = crypto.createHmac('sha256', integraciones.flow_secret_key.trim()).update(toSign).digest('hex');
  params.s = signature;

  const queryString = Object.keys(params)
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join('&');

  const statusEndpoint = integraciones.flow_sandbox
    ? 'https://sandbox.flow.cl/api/payment/getStatus'
    : 'https://www.flow.cl/api/payment/getStatus';

  const statusRes = await fetch(`${statusEndpoint}?${queryString}`);
  if (!statusRes.ok) {
    console.error('Error consultando estado en Flow:', await statusRes.text());
    return NextResponse.json({ error: 'Error al verificar el pago.' }, { status: 502 });
  }

  const flowStatus = await statusRes.json();

  // status: 1 = pendiente, 2 = pagado, 3 = rechazado
  if (parseInt(flowStatus.status, 10) === 2) {
    const pedidoId = flowStatus.commerceOrder;
    const { error: updateError } = await supabase
      .from('pedidos')
      .update({ status: 'Pagado' })
      .eq('id', pedidoId)
      .eq('external_token', token); // doble check: el token debe coincidir con el que guardamos

    if (updateError) {
      console.error(`Error actualizando pedido ${pedidoId} a Pagado:`, updateError);
    }
  }

  return new NextResponse('OK', { status: 200 });
}
