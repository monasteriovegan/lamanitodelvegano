import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

/**
 * Tracking público de un solo pedido. La búsqueda ocurre siempre en servidor
 * y acepta el tracking_number generado automáticamente o, para compatibilidad
 * con pedidos antiguos, el ID numérico exacto del pedido.
 */
export async function GET(req: NextRequest) {
  const rawId = req.nextUrl.searchParams.get('id')?.trim();
  if (!rawId) {
    return NextResponse.json({ error: 'Ingresa el número de seguimiento de tu pedido.' }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();
  const numericId = /^\d+$/.test(rawId) ? Number(rawId) : null;
  const normalizedTracking = rawId.toUpperCase();

  let query = supabase
    .from('pedidos')
    .select('id,nombre_cliente,direccion,shipping_zone_name,fecha_entrega,metodopago,estado,total,created_at,tracking_number,payment_status');

  if (numericId !== null && Number.isInteger(numericId) && numericId > 0) {
    query = query.eq('id', numericId);
  } else {
    query = query.eq('tracking_number', normalizedTracking);
  }

  const { data: pedido, error } = await query.maybeSingle();

  if (error) {
    console.error('tracking_lookup_failed', { reason: error.message });
    return NextResponse.json({ error: 'Error al buscar el pedido.' }, { status: 500 });
  }

  if (!pedido) {
    return NextResponse.json({ error: 'No se encontró ningún pedido con ese número de seguimiento.' }, { status: 404 });
  }

  return NextResponse.json({
    id: String(pedido.id),
    trackingNumber: pedido.tracking_number || null,
    nombreCliente: pedido.nombre_cliente || 'Cliente',
    direccion: pedido.direccion || 'Por confirmar',
    zonaEnvio: pedido.shipping_zone_name || null,
    fechaDespacho: pedido.fecha_entrega || null,
    metodoPago: pedido.metodopago || null,
    status: pedido.estado || 'Pendiente',
    paymentStatus: pedido.payment_status || 'pending',
    total: Number(pedido.total || 0),
    createdAt: pedido.created_at,
  });
}
