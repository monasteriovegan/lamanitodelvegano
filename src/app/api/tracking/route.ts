import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

/**
 * Tracking público por código único LMV-XXXXXX.
 * Por compatibilidad también acepta el ID integer completo del pedido, pero ya
 * no hace búsquedas parciales que puedan revelar accidentalmente otro pedido.
 */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('id')?.trim() || '';
  const tracking = raw.replace(/^#/, '').toUpperCase();
  if (!tracking) {
    return NextResponse.json({ error: 'Ingresa tu código de seguimiento.' }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();
  let query = supabase
    .from('pedidos')
    .select('id,nombre_cliente,direccion,comuna,total,estado,metodopago,payment_status,fecha_entrega,shipping_zone_name,tracking_number,created_at');

  if (/^LMV-\d{6,}$/.test(tracking)) {
    query = query.eq('tracking_number', tracking);
  } else if (/^\d+$/.test(tracking)) {
    query = query.eq('id', Number(tracking));
  } else {
    return NextResponse.json({ error: 'El código debe tener formato LMV-000001.' }, { status: 400 });
  }

  const { data: pedido, error } = await query.maybeSingle();
  if (error) {
    console.error('tracking_lookup_failed', { detail: error.message });
    return NextResponse.json({ error: 'Error al buscar el pedido.' }, { status: 500 });
  }

  if (!pedido) {
    return NextResponse.json({ error: 'No se encontró ningún pedido con ese código.' }, { status: 404 });
  }

  return NextResponse.json({
    id: String(pedido.id),
    trackingNumber: pedido.tracking_number,
    nombreCliente: pedido.nombre_cliente || '',
    direccion: pedido.direccion || '',
    zonaEnvio: pedido.shipping_zone_name || pedido.comuna || null,
    fechaDespacho: pedido.fecha_entrega || null,
    metodoPago: pedido.metodopago || null,
    paymentStatus: pedido.payment_status || 'pending',
    status: pedido.estado || 'Pendiente',
    total: Number(pedido.total || 0),
    createdAt: pedido.created_at,
  });
}
