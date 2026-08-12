import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { calcularPedido } from '@/lib/pricing/calcular-pedido';
import { validarPin } from '@/lib/pricing/fidelidad';
import { enviarEmail } from '@/lib/email/resend';
import { plantillaConfirmacionPedido } from '@/lib/email/templates';
import type { CheckoutRequest, Pedido } from '@/types/domain';
import { BusinessRepository } from '@/lib/repositories/business-repository';
import { CustomerRepository } from '@/lib/repositories/customers-repository';
import { OrderRepository } from '@/lib/repositories/orders-repository';
import { getSchemaCapabilities } from '@/lib/repositories/schema-capabilities';

/**
 * Único punto de entrada para crear un pedido. Recalcula TODO server-side
 * contra la base de datos real antes de guardar — el cliente solo manda
 * intenciones (IDs, cantidades), nunca precios ni totales.
 *
 * La escritura pasa por OrderRepository y solo se habilita después de verificar
 * el schema reconciliado y el descuento atómico de stock UUID.
 */
export async function POST(req: NextRequest) {
  const body: CheckoutRequest = await req.json();

  if (!body.cliente?.nombre || !body.cliente?.telefono) {
    return NextResponse.json({ error: 'Faltan datos del cliente.' }, { status: 400 });
  }

  const capabilities = getSchemaCapabilities();
  if (!capabilities.checkoutWrites) {
    return NextResponse.json(
      {
        error: 'Checkout temporalmente bloqueado hasta aplicar y verificar el schema reconciliado.',
        code: 'SCHEMA_MIGRATION_REQUIRED',
      },
      { status: 503 },
    );
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
  const business = await new BusinessRepository(supabase).requireDefault();
  const customerRepository = new CustomerRepository(supabase, capabilities);
  const customer = await customerRepository.upsertCheckoutContact(business.id, {
    email: body.cliente.email,
    phone: body.cliente.telefono,
    nombre: body.cliente.nombre,
    direccion: body.cliente.direccion,
  });

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

  const pedido = await new OrderRepository(supabase, capabilities).createTransactionalCheckout({
    businessUnitId: business.id,
    customerId: customer.id,
    customerEmail: customer.email || null,
    customerName: body.cliente.nombre,
    customerPhone: customer.phone || body.cliente.telefono,
    address: body.cliente.direccion || null,
    comuna: null,
    items: itemsFinales,
    total: totalConFidelidad,
    paymentMethod: body.metodoPago,
    shippingCost: calculo.costoEnvio || 0,
    shippingZoneId: body.zonaId,
    shippingZoneName: calculo.zonaNombre || null,
    loyaltyDiscount: descuentoFidelidad,
    loyaltyPointsRedeemed: puntosCanjeados,
    discountTotal: (calculo.descuentoCupon || 0) + descuentoFidelidad,
    stockItems: calculo.itemsResueltos || [],
    attribution: body.attribution || {},
  });

  // Email de confirmación — best-effort: si falla, el pedido ya está
  // creado y no debe perderse por un problema de Resend. Se registra el
  // error en logs, nunca se le devuelve un 500 al cliente por esto.
  if (body.cliente.email) {
    enviarEmail({
      to: body.cliente.email,
      subject: `Pedido confirmado #${pedido.id.slice(0, 8)} — La Manito Del Vegano`,
      html: plantillaConfirmacionPedido({ ...pedido, id: String(pedido.id), cliente: body.cliente, zonaEnvio: calculo.zonaNombre, costoEnvio: calculo.costoEnvio } as unknown as Pedido),
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
