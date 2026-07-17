import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { calcularPedido } from '@/lib/pricing/calcular-pedido';
import { validarPin } from '@/lib/pricing/fidelidad';
import { enviarEmail } from '@/lib/email/resend';
import { plantillaConfirmacionPedido } from '@/lib/email/templates';
import type { CheckoutRequest, Pedido } from '@/types/domain';

/**
 * Único punto de entrada para crear un pedido. Recalcula TODO server-side
 * contra la base de datos real antes de guardar — el cliente solo manda
 * intenciones (IDs, cantidades), nunca precios ni totales.
 *
 * Inserta usando los NOMBRES DE COLUMNA REALES de la tabla `pedidos`
 * compartida con el sitio viejo (camelCase: zonaEnvio, fechaDespacho, etc.)
 */
export async function POST(req: NextRequest) {
  const body: CheckoutRequest = await req.json();

  if (!body.cliente?.nombre || !body.cliente?.telefono) {
    return NextResponse.json({ error: 'Faltan datos del cliente.' }, { status: 400 });
  }

  const calculo = await calcularPedido(body);
  if (!calculo.ok) {
    return NextResponse.json({ error: calculo.error }, { status: 400 });
  }

  let descuentoFidelidad = 0;
  let puntosCanjeados = 0;

  if (body.canjearPuntos && body.pinFidelidad) {
    const pinCheck = await validarPin(body.cliente.email, body.cliente.telefono, body.pinFidelidad);
    if (!pinCheck.ok) {
      return NextResponse.json({ error: pinCheck.error }, { status: 400 });
    }
    const { consultarPuntosCliente } = await import('@/lib/pricing/fidelidad');
    const puntos = await consultarPuntosCliente(body.cliente.email, body.cliente.telefono);
    if (puntos.ok && puntos.puntosDisponibles > 0) {
      const supabase = createSupabaseServiceClient();
      const { data: ajustesRow } = await supabase.from('ajustes').select('data').eq('id', 'global').maybeSingle();
      const valorPunto = ajustesRow?.data?.valorPunto || 100;
      puntosCanjeados = puntos.puntosDisponibles;
      descuentoFidelidad = puntosCanjeados * valorPunto;
    }
  }

  const totalConFidelidad = Math.max(
    0,
    (calculo.subtotal || 0) + (calculo.costoEnvio || 0) - (calculo.descuentoCupon || 0) - descuentoFidelidad
  );

  const supabase = createSupabaseServiceClient();

  const itemsFinales = [...(calculo.itemsResueltos || [])];
  if (calculo.cuponValido?.tipo === 'regalo') {
    itemsFinales.push({
      productoId: `gift_${Date.now()}`,
      nombre: `${calculo.cuponValido.code} 🎁 (Regalo)`,
      precio: 0,
      qty: 1,
      emoji: '🎁',
    });
  }

  const { data: pedido, error: insertError } = await supabase
    .from('pedidos')
    .insert({
      cliente: body.cliente,
      items: itemsFinales,
      total: totalConFidelidad,
      descuentoFidelidad: descuentoFidelidad,
      puntosCanjeados: puntosCanjeados,
      puntosGanados: 0,
      status: body.metodoPago === 'whatsapp' ? 'WhatsApp' : 'Pendiente',
      zonaEnvio: calculo.zonaNombre,
      costoEnvio: calculo.costoEnvio,
      metodoPago: body.metodoPago,
    })
    .select()
    .single();

  if (insertError || !pedido) {
    console.error('Error creando pedido:', insertError);
    return NextResponse.json({ error: 'No se pudo crear el pedido.' }, { status: 500 });
  }

  for (const item of calculo.itemsResueltos || []) {
    await supabase.rpc('descontar_stock', { p_producto_id: item.productoId, p_cantidad: item.qty });
  }

  // Email de confirmación — best-effort: si falla, el pedido ya está
  // creado y no debe perderse por un problema de Resend. Se registra el
  // error en logs, nunca se le devuelve un 500 al cliente por esto.
  if (body.cliente.email) {
    enviarEmail({
      to: body.cliente.email,
      subject: `Pedido confirmado #${pedido.id.slice(0, 8)} — La Manito Del Vegano`,
      html: plantillaConfirmacionPedido(pedido as Pedido),
    }).then((res) => {
      if (!res.ok) console.error('No se pudo enviar email de confirmación:', res.error);
    });
  }

  // Si este cliente tenía un carrito marcado como abandonado, se limpia:
  // ya completó la compra, no debe recibir un recordatorio de algo que
  // ya pagó.
  const identificadorCarrito = body.cliente.email || body.cliente.telefono;
  if (identificadorCarrito) {
    await supabase
      .from('carritos_abandonados')
      .update({ recuperado: true })
      .or(`email.eq.${body.cliente.email || ''},telefono.eq.${body.cliente.telefono || ''}`)
      .eq('recuperado', false);
  }

  return NextResponse.json({
    pedidoId: pedido.id,
    total: totalConFidelidad,
  });
}
