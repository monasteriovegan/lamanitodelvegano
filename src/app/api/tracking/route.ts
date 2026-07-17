import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

/**
 * Reemplaza buscarPedidoTracking() del app.js viejo, que descargaba TODA
 * la tabla `pedidos` (con datos de todos los clientes) al navegador para
 * buscar uno por prefijo de ID. Aquí la búsqueda ocurre en el servidor:
 * el cliente nunca ve más que el pedido que pidió, y solo si el ID/prefijo
 * coincide exactamente con uno real.
 */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')?.trim().toLowerCase();
  if (!id || id.length < 4) {
    return NextResponse.json({ error: 'Ingresa al menos 4 caracteres del ID de tu pedido.' }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();

  // Postgres no soporta "empieza con" directo sobre uuid, así que comparamos
  // contra el texto del id. Esto sigue siendo seguro: solo se devuelve el
  // pedido que matchea, nunca una lista.
  const { data: pedidos, error } = await supabase
    .from('pedidos')
    .select('id, cliente, items, total, status, metodoPago, fechaDespacho, zonaEnvio, createdAt')
    .ilike('id', `${id}%`)
    .limit(1);

  if (error) {
    return NextResponse.json({ error: 'Error al buscar el pedido.' }, { status: 500 });
  }

  if (!pedidos || pedidos.length === 0) {
    return NextResponse.json({ error: 'No se encontró ningún pedido con ese ID.' }, { status: 404 });
  }

  const pedido = pedidos[0];

  // Devolvemos solo lo necesario para mostrar el tracking, no datos extra.
  return NextResponse.json({
    id: pedido.id,
    nombreCliente: pedido.cliente?.nombre,
    direccion: pedido.cliente?.direccion,
    zonaEnvio: pedido.zonaEnvio,
    fechaDespacho: pedido.fechaDespacho,
    metodoPago: pedido.metodoPago,
    status: pedido.status,
    total: pedido.total,
    createdAt: pedido.createdAt,
  });
}
