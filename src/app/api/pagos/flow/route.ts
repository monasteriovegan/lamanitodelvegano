import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const { pedidoId } = await req.json();
  if (!pedidoId) {
    return NextResponse.json({ error: 'Falta pedidoId.' }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();

  const { data: pedido, error } = await supabase.from('pedidos').select('*').eq('id', pedidoId).maybeSingle();
  if (error || !pedido) {
    return NextResponse.json({ error: 'Pedido no encontrado.' }, { status: 404 });
  }

  const { data: integraciones } = await supabase
    .from('integraciones_secretas')
    .select('flow_enabled, flow_sandbox, flow_api_key, flow_secret_key')
    .eq('id', 'global')
    .maybeSingle();

  if (!integraciones?.flow_enabled || !integraciones.flow_api_key || !integraciones.flow_secret_key) {
    return NextResponse.json({ error: 'Flow no está configurado o activado.' }, { status: 500 });
  }

  const origin = req.headers.get('origin') || 'https://lamanitodelvegano.vercel.app';

  const flowParams: Record<string, string> = {
    amount: pedido.total.toString(),
    apiKey: integraciones.flow_api_key.trim(),
    commerceOrder: pedidoId,
    email: pedido.cliente.email || 'cliente@lamanitodelvegano.cl',
    subject: `Pedido #${pedidoId.substring(0, 6).toUpperCase()} - La Manito Del Vegano`,
    urlConfirmation: `${origin}/api/pagos/flow-confirm`,
    urlReturn: `${origin}/pedido/${pedidoId}?status=success`,
  };

  const keysOrdenadas = Object.keys(flowParams).sort();
  const toSign = keysOrdenadas.map((k) => k + flowParams[k]).join('');
  const signature = crypto.createHmac('sha256', integraciones.flow_secret_key.trim()).update(toSign).digest('hex');
  flowParams.s = signature;

  const formBody = Object.keys(flowParams)
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(flowParams[k])}`)
    .join('&');

  const flowEndpoint = integraciones.flow_sandbox
    ? 'https://sandbox.flow.cl/api/payment/create'
    : 'https://www.flow.cl/api/payment/create';

  const flowRes = await fetch(flowEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formBody,
  });

  if (!flowRes.ok) {
    const errBody = await flowRes.text();
    console.error('Error de Flow:', errBody);
    return NextResponse.json({ error: 'Error al crear el pago con Flow.' }, { status: 502 });
  }

  const flowData = await flowRes.json();
  if (!flowData.url || !flowData.token) {
    return NextResponse.json({ error: 'Flow no devolvió una URL de pago válida.' }, { status: 502 });
  }

  // Guardamos el token de Flow para reconciliar el webhook después
  await supabase.from('pedidos').update({ external_token: flowData.token }).eq('id', pedidoId);

  return NextResponse.json({ url: `${flowData.url}?token=${flowData.token}` });
}
