import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

/**
 * Crea la preferencia de pago en Mercado Pago.
 * Recibe SOLO un pedidoId (ya creado y validado por /api/checkout).
 * Lee el total real desde la base de datos — nunca confía en un monto
 * que venga en el body de la request.
 */
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
    .select('mp_access_token')
    .eq('id', 'global')
    .maybeSingle();

  const mpAccessToken = (integraciones?.mp_access_token || '').trim();
  if (!mpAccessToken) {
    return NextResponse.json({ error: 'Mercado Pago no está configurado.' }, { status: 500 });
  }

  const items = (pedido.items as { nombre: string; precio: number; qty: number }[]).map((item) => ({
    title: item.nombre,
    quantity: item.qty,
    unit_price: item.precio,
    currency_id: 'CLP',
  }));

  if (pedido.costoEnvio > 0) {
    items.push({
      title: `Despacho: ${pedido.zonaEnvio || 'Zona seleccionada'}`,
      quantity: 1,
      unit_price: pedido.costoEnvio,
      currency_id: 'CLP',
    });
  }

  const origin = req.headers.get('origin') || 'https://lamanitodelvegano.vercel.app';

  const preferencePayload = {
    items,
    payer: {
      name: pedido.cliente.nombre,
      phone: pedido.cliente.telefono ? { number: pedido.cliente.telefono } : undefined,
    },
    back_urls: {
      success: `${origin}/pedido/${pedidoId}?status=success`,
      failure: `${origin}/pedido/${pedidoId}?status=failure`,
      pending: `${origin}/pedido/${pedidoId}?status=pending`,
    },
    auto_return: 'approved',
    external_reference: pedidoId,
  };

  const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${mpAccessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(preferencePayload),
  });

  if (!mpResponse.ok) {
    const errBody = await mpResponse.text();
    console.error('Error de Mercado Pago:', errBody);
    return NextResponse.json({ error: 'Error al crear la preferencia de pago.' }, { status: 502 });
  }

  const mpData = await mpResponse.json();
  return NextResponse.json({ init_point: mpData.init_point });
}
