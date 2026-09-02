import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { sendPaidPurchaseToMeta } from '@/lib/meta/conversions-api';

/** Flow notifica un token; el estado real se consulta server-side con firma. */
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const token = formData.get('token') as string | null;
  if (!token) return NextResponse.json({ error: 'Falta el token de pago.' }, { status: 400 });

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
  const toSign = Object.keys(params).sort().map((key) => key + params[key]).join('');
  params.s = crypto.createHmac('sha256', integraciones.flow_secret_key.trim()).update(toSign).digest('hex');
  const statusEndpoint = integraciones.flow_sandbox
    ? 'https://sandbox.flow.cl/api/payment/getStatus'
    : 'https://www.flow.cl/api/payment/getStatus';
  const statusRes = await fetch(`${statusEndpoint}?${new URLSearchParams(params).toString()}`, { cache: 'no-store' });
  if (!statusRes.ok) {
    console.error('flow_status_failed', { status: statusRes.status });
    return NextResponse.json({ error: 'Error al verificar el pago.' }, { status: 502 });
  }

  const flowStatus = await statusRes.json();
  const pedidoId = Number(flowStatus?.commerceOrder);
  if (!Number.isInteger(pedidoId) || pedidoId <= 0) return new NextResponse('OK', { status: 200 });

  const { data: pedido, error: orderError } = await supabase.from('pedidos')
    .select('id,estado,payment_status,external_token,metodopago')
    .eq('id', pedidoId)
    .eq('external_token', token)
    .maybeSingle();
  if (orderError) throw orderError;
  if (!pedido || String(pedido.metodopago || '').toLowerCase() !== 'flow') return new NextResponse('OK', { status: 200 });

  // Flow: 1 pendiente, 2 pagado, 3 rechazado. Otros estados se mantienen pendientes.
  const numericStatus = Number(flowStatus?.status);
  const nextPaymentStatus = numericStatus === 2 ? 'paid' : numericStatus === 3 ? 'failed' : 'pending';
  const currentPaymentStatus = String(pedido.payment_status || 'pending');
  const effectiveStatus = currentPaymentStatus === 'paid' && nextPaymentStatus !== 'paid' ? 'paid' : nextPaymentStatus;

  if (effectiveStatus !== currentPaymentStatus) {
    const update: Record<string, any> = { payment_status: effectiveStatus, updated_at: new Date().toISOString() };
    if (effectiveStatus === 'paid') update.estado = 'Pagado';
    const { error: updateError } = await supabase.from('pedidos').update(update).eq('id', pedidoId).eq('external_token', token);
    if (updateError) throw updateError;
    await supabase.from('order_status_history').insert({
      pedido_id: pedidoId,
      old_status: String(pedido.estado || 'Pendiente'),
      new_status: effectiveStatus === 'paid' ? 'Pagado' : String(pedido.estado || 'Pendiente'),
      payment_status: effectiveStatus,
      notes: `Flow status ${numericStatus}`,
    });
    if (effectiveStatus === 'paid') await sendPaidPurchaseToMeta(supabase, pedidoId);
  }

  return new NextResponse('OK', { status: 200 });
}
