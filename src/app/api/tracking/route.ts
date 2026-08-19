import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

/**
 * Tracking público exclusivamente por código privado LMV-XXXXXXXXXX.
 * No acepta IDs numéricos ni prefijos parciales para evitar enumeración de pedidos.
 */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('id')?.trim() || '';
  const tracking = raw.replace(/^#/, '').toUpperCase();
  if (!tracking) {
    return NextResponse.json({ error: 'Ingresa tu código de seguimiento.' }, { status: 400 });
  }
  if (!/^LMV-[0-9A-F]{10}$/.test(tracking)) {
    return NextResponse.json({ error: 'El código de seguimiento no es válido.' }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();
  const { data: pedido, error } = await supabase
    .from('pedidos')
    .select('id,nombre_cliente,direccion,comuna,total,estado,metodopago,payment_status,fecha_entrega,shipping_zone_name,tracking_number,created_at')
    .eq('tracking_number', tracking)
    .maybeSingle();

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
