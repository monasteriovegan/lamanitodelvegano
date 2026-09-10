import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { calcularPedido, type CatalogCheckoutRequest } from '@/lib/pricing/calcular-pedido';
import { genFechas } from '@/lib/pricing/fechas';
import { validarPin } from '@/lib/pricing/fidelidad';
import { enviarEmail } from '@/lib/email/resend';
import { plantillaConfirmacionPedido } from '@/lib/email/templates';
import type { Pedido } from '@/types/domain';
import { BusinessRepository } from '@/lib/repositories/business-repository';
import { CustomerRepository } from '@/lib/repositories/customers-repository';
import { OrderRepository } from '@/lib/repositories/orders-repository';
import { getSchemaCapabilities } from '@/lib/repositories/schema-capabilities';
import { verifyCheckoutSchemaReady } from '@/lib/repositories/checkout-schema-readiness';

type ProductionCheckoutRequest = CatalogCheckoutRequest & {
  cliente: CatalogCheckoutRequest['cliente'] & { comuna?: string };
  fechaEntrega?: string | null;
  resumePedidoId?: string | number | null;
};

function parseAvailability(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item));
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item));
}

function dateToYmd(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

async function validDeliveryDates(productIds: string[]) {
  const db = createSupabaseServiceClient();
  const uniqueIds = Array.from(new Set(productIds.filter(Boolean)));
  if (!uniqueIds.length) return [];
  const { data, error } = await db
    .from('productos')
    .select('id,disponibilidad')
    .in('id', uniqueIds)
    .eq('activo', true);
  if (error) throw error;
  if ((data || []).length !== uniqueIds.length) return [];
  return genFechas((data || []).map((row: any) => ({ disponibilidad: parseAvailability(row.disponibilidad) })))
    .filter((item) => item.ok)
    .map((item) => dateToYmd(item.fecha));
}

function normalizedResumeItems(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw.map((item: any) => ({
    productoId: String(item?.productoId || item?.product_id || ''),
    qty: Number(item?.qty || item?.quantity || 0),
    precio: Number(item?.precio || item?.unit_price || item?.price || 0),
    formato: String(item?.formato || ''),
    variedad: String(item?.variedad || ''),
    sku: String(item?.sku || ''),
  })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

async function resumeCheckoutOrder(
  db: ReturnType<typeof createSupabaseServiceClient>,
  input: {
    resumePedidoId: unknown;
    businessUnitId: string;
    customerId: string;
    total: number;
    items: unknown[];
    shippingZoneId: string;
    deliveryDate: string;
    paymentMethod: string;
  },
) {
  const pedidoId = Number(input.resumePedidoId);
  if (!Number.isInteger(pedidoId) || pedidoId <= 0) return null;

  const { data: existing, error } = await db
    .from('pedidos')
    .select('id,business_unit_id,customer_id,items,total,payment_status,source_channel,fecha_entrega,shipping_zone_id,metodopago')
    .eq('id', pedidoId)
    .maybeSingle();
  if (error) throw error;
  if (!existing) return null;

  const sameOrder = String(existing.business_unit_id || '') === input.businessUnitId
    && String(existing.customer_id || '') === input.customerId
    && String(existing.source_channel || '') === 'web'
    && String(existing.payment_status || '') === 'pending'
    && Number(existing.total || 0) === Math.round(input.total)
    && String(existing.shipping_zone_id || '') === input.shippingZoneId
    && String(existing.fecha_entrega || '') === input.deliveryDate
    && JSON.stringify(normalizedResumeItems(existing.items)) === JSON.stringify(normalizedResumeItems(input.items));

  if (!sameOrder) return null;

  const { data: updated, error: updateError } = await db
    .from('pedidos')
    .update({
      metodopago: input.paymentMethod,
      estado: input.paymentMethod === 'whatsapp' ? 'WhatsApp' : 'Pendiente',
      updated_at: new Date().toISOString(),
    })
    .eq('id', pedidoId)
    .eq('payment_status', 'pending')
    .select('id')
    .single();
  if (updateError) throw updateError;
  return updated ? { id: String(updated.id) } : null;
}

export async function GET(req: NextRequest) {
  const ids = String(req.nextUrl.searchParams.get('productIds') || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 50);
  if (!ids.length) return NextResponse.json({ deliveryDates: [] });
  try {
    return NextResponse.json({ deliveryDates: await validDeliveryDates(ids) });
  } catch {
    return NextResponse.json({ error: 'No se pudieron cargar las fechas de entrega.' }, { status: 500 });
  }
}

/**
 * Único punto de entrada para crear un pedido. Recalcula TODO server-side
 * contra la base de datos real antes de guardar — el cliente solo manda
 * intenciones (IDs, cantidades), nunca precios ni totales.
 *
 * El checkout permanece fail-closed, pero la habilitación ya no depende de
 * un flag manual: el servicio verifica el schema real de producción mediante
 * checkout_schema_ready_v2 antes de cualquier cálculo o escritura.
 */
export async function POST(req: NextRequest) {
  const body: ProductionCheckoutRequest = await req.json();
  const idempotencyKey = req.headers.get('Idempotency-Key') || body.idempotencyKey;
  const comuna = String(body.cliente?.comuna || '').trim();
  const fechaEntrega = String(body.fechaEntrega || '').trim();
  const paymentMethod = String(body.metodoPago || '').trim().toLowerCase();

  if (!body.cliente?.nombre || !body.cliente?.telefono || !body.cliente?.direccion || !comuna || !fechaEntrega || !idempotencyKey) {
    return NextResponse.json({ error: 'Faltan datos del cliente o de la entrega.' }, { status: 400 });
  }
  if (!['mercadopago', 'whatsapp', 'flow'].includes(paymentMethod)) {
    return NextResponse.json({ error: 'Método de pago inválido.' }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();
  const schemaReady = await verifyCheckoutSchemaReady(supabase);
  if (!schemaReady) {
    return NextResponse.json(
      {
        error: 'Checkout temporalmente bloqueado hasta aplicar y verificar el schema reconciliado.',
        code: 'SCHEMA_MIGRATION_REQUIRED',
      },
      { status: 503 },
    );
  }

  // Flow is controlled from the persisted integration configuration. When it is
  // disabled or incomplete we fail before creating/updating customers or orders,
  // so a hidden/old client cannot leave a dead pending order behind.
  if (paymentMethod === 'flow') {
    const { data: flowConfig, error: flowConfigError } = await supabase
      .from('integraciones_secretas')
      .select('flow_enabled,flow_api_key,flow_secret_key')
      .eq('id', 'global')
      .maybeSingle();
    const flowReady = !flowConfigError
      && Boolean(flowConfig?.flow_enabled)
      && Boolean(String(flowConfig?.flow_api_key || '').trim())
      && Boolean(String(flowConfig?.flow_secret_key || '').trim());
    if (!flowReady) {
      return NextResponse.json({ error: 'Flow está temporalmente desactivado.' }, { status: 503 });
    }
  }

  const capabilities = getSchemaCapabilities();
  const business = await new BusinessRepository(supabase).requireDefault();

  const allowedDates = await validDeliveryDates((body.items || []).map((item) => item.productoId));
  if (!allowedDates.includes(fechaEntrega)) {
    return NextResponse.json({ error: 'La fecha de entrega seleccionada ya no está disponible.' }, { status: 400 });
  }

  if (!body.zonaId) {
    return NextResponse.json({ error: 'Selecciona una zona de despacho.' }, { status: 400 });
  }
  const { data: selectedZone, error: zoneError } = await supabase
    .from('zonas')
    .select('id,comunas,precio')
    .eq('id', body.zonaId)
    .maybeSingle();
  if (zoneError) throw zoneError;
  if (!selectedZone) return NextResponse.json({ error: 'Zona de despacho inválida.' }, { status: 400 });
  const zoneCommunes = String(selectedZone.comunas || '')
    .split(',')
    .map((item) => item.trim().toLocaleLowerCase('es-CL'))
    .filter(Boolean);
  if (zoneCommunes.length && !zoneCommunes.includes(comuna.toLocaleLowerCase('es-CL'))) {
    return NextResponse.json({ error: 'La comuna no corresponde a la zona de despacho seleccionada.' }, { status: 400 });
  }

  const calculo = await calcularPedido(body, business.id);
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
      const { data: ajustesRow } = await supabase.from('ajustes').select('data').eq('id', 'global').maybeSingle();
      const valorPunto = ajustesRow?.data?.valorPunto || 100;
      puntosCanjeados = puntos.puntosDisponibles;
      descuentoFidelidad = puntosCanjeados * valorPunto;
    }
  }

  const totalConFidelidad = Math.max(
    0,
    (calculo.subtotal || 0) + (calculo.costoEnvio || 0) - (calculo.descuentoCupon || 0) - descuentoFidelidad,
  );

  const customerRepository = new CustomerRepository(supabase, capabilities);
  const customer = await customerRepository.upsertCheckoutContact(business.id, {
    email: body.cliente.email,
    phone: body.cliente.telefono,
    nombre: body.cliente.nombre,
    direccion: body.cliente.direccion,
    comuna,
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

  const resumed = await resumeCheckoutOrder(supabase, {
    resumePedidoId: body.resumePedidoId,
    businessUnitId: business.id,
    customerId: customer.id,
    total: totalConFidelidad,
    items: itemsFinales,
    shippingZoneId: body.zonaId,
    deliveryDate: fechaEntrega,
    paymentMethod,
  });

  const pedido = resumed || await new OrderRepository(supabase, capabilities).createTransactionalCheckout({
    idempotencyKey,
    businessUnitId: business.id,
    customerId: customer.id,
    customerEmail: customer.email || null,
    customerName: body.cliente.nombre,
    customerPhone: customer.phone || body.cliente.telefono,
    address: body.cliente.direccion || null,
    comuna,
    items: itemsFinales,
    total: totalConFidelidad,
    paymentMethod,
    shippingCost: calculo.costoEnvio || 0,
    shippingZoneId: body.zonaId,
    shippingZoneName: calculo.zonaNombre || null,
    loyaltyDiscount: descuentoFidelidad,
    loyaltyPointsRedeemed: puntosCanjeados,
    discountTotal: (calculo.descuentoCupon || 0) + descuentoFidelidad,
    stockItems: calculo.itemsResueltos || [],
    attribution: body.attribution || {},
    notes: body.notas || null,
  });

  const { error: deliveryDetailsError } = await supabase
    .from('pedidos')
    .update({
      fecha_entrega: fechaEntrega,
      notas: body.notas?.trim() || null,
      comuna,
      direccion: body.cliente.direccion,
    })
    .eq('id', Number(pedido.id));
  if (deliveryDetailsError) throw deliveryDetailsError;

  if (!resumed && body.cliente.email) {
    enviarEmail({
      to: body.cliente.email,
      subject: `Pedido recibido #${pedido.id.slice(0, 8)} — La Manito Del Vegano`,
      html: plantillaConfirmacionPedido({
        ...pedido,
        id: String(pedido.id),
        cliente: { ...body.cliente, comuna },
        fechaDespacho: fechaEntrega,
        zonaEnvio: calculo.zonaNombre,
        costoEnvio: calculo.costoEnvio,
      } as unknown as Pedido),
    }).then((res) => {
      if (!res.ok) console.error('No se pudo enviar email de confirmación:', res.error);
    });
  }

  const identificadorCarrito = body.cliente.email || body.cliente.telefono;
  if (identificadorCarrito) {
    await supabase
      .from('carritos_abandonados')
      .update({ recuperado: true })
      .or(`email.eq.${body.cliente.email || ''},telefono.eq.${body.cliente.telefono || ''}`)
      .eq('recuperado', false);
  }

  return NextResponse.json({ pedidoId: pedido.id, total: totalConFidelidad, resumed: Boolean(resumed) });
}