import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { getCurrentAdminUser } from '@/lib/supabase/server-auth';
import { OrderRepository } from '@/lib/repositories/orders-repository';
import { SchemaCapabilityError } from '@/lib/repositories/schema-capabilities';
import { notifyOrderTransitions } from '@/lib/orders/order-notifications';
import { sendPaidPurchaseToMeta } from '@/lib/meta/conversions-api';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PUT(req: Request, { params }: RouteParams) {
  const admin = await getCurrentAdminUser();
  if (!admin || !['admin', 'soporte', 'bodega'].includes(admin.rol)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await params;
  const db = createSupabaseServiceClient();
  const body = await req.json();

  try {
    const repo = new OrderRepository(db);
    const before = await repo.getById(id);
    if (!before) return NextResponse.json({ error: 'Pedido no encontrado.' }, { status: 404 });

    const requestedStatus = String(body?.status || '').trim().toLowerCase();
    let updatedOrder;

    // El estado operativo y el pago son conceptos distintos. Confirmar o empezar
    // a preparar un pedido no debe convertirlo en "Pagado" si el pago sigue pendiente.
    if (requestedStatus === 'confirmed' || requestedStatus === 'processing') {
      const requestedPaymentStatus = body?.payment_status === undefined
        ? before.payment_status
        : String(body.payment_status || 'pending');

      if (requestedPaymentStatus !== 'paid') {
        const legacyStatus = requestedStatus === 'confirmed' ? 'Confirmado' : 'Procesando';
        const patch: Record<string, unknown> = {
          estado: legacyStatus,
          updated_at: new Date().toISOString(),
        };
        if (body?.payment_status !== undefined) patch.payment_status = requestedPaymentStatus;
        if (body?.tracking_number !== undefined) patch.tracking_number = body.tracking_number || null;
        if (body?.admin_notes !== undefined) patch.admin_notes = body.admin_notes || null;

        const { error: updateError } = await db.from('pedidos').update(patch).eq('id', Number(id));
        if (updateError) throw updateError;

        if (before.legacy_status !== legacyStatus) {
          const { error: historyError } = await db.from('order_status_history').insert({
            pedido_id: Number(id),
            old_status: before.legacy_status,
            new_status: legacyStatus,
            payment_status: requestedPaymentStatus,
            notes: body?.admin_notes || 'Actualización desde panel administrativo',
            changed_by: admin.id,
          });
          if (historyError) throw historyError;
        }

        updatedOrder = await repo.getById(id);
      }
    }

    if (!updatedOrder) updatedOrder = await repo.update(id, body, admin.id);
    if (!updatedOrder) throw new Error('order_update_failed');

    // Las notificaciones son transaccionales y deterministas: no dependen del
    // interruptor de IA de Remy y nunca bloquean un cambio operativo si el canal falla.
    let notifications: Awaited<ReturnType<typeof notifyOrderTransitions>> = [];
    try {
      notifications = await notifyOrderTransitions(db, before, updatedOrder);
    } catch (notificationError) {
      console.error('order_transition_notification_failed', {
        orderId: updatedOrder.numeric_id,
        reason: notificationError instanceof Error ? notificationError.message : 'unknown',
      });
    }

    if (before.payment_status !== 'paid' && updatedOrder.payment_status === 'paid') {
      await sendPaidPurchaseToMeta(db, updatedOrder.numeric_id);
    }

    return NextResponse.json({ ok: true, data: updatedOrder, notifications });
  } catch (error) {
    const status = error instanceof SchemaCapabilityError ? 503 : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'order_update_failed' }, { status });
  }
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  const admin = await getCurrentAdminUser();
  if (!admin || admin.rol !== 'admin') {
    return NextResponse.json({ error: 'Solo un administrador puede eliminar pedidos.' }, { status: 401 });
  }

  const { id } = await params;
  const pedidoId = Number(id);
  if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
    return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 });
  }

  const db = createSupabaseServiceClient();
  const { data, error } = await db.rpc('admin_delete_order_v1', {
    p_pedido_id: pedidoId,
    p_actor: admin.id,
  });

  if (error) {
    const reason = String(error.message || '');
    if (reason.includes('pedido_not_found')) {
      return NextResponse.json({ error: 'Pedido no encontrado.' }, { status: 404 });
    }
    if (reason.includes('order_delete_protected_payment')) {
      return NextResponse.json(
        { error: 'Este pedido tiene trazabilidad de pago y no se puede eliminar. Cancélalo o reembólsalo para conservar el historial.' },
        { status: 409 },
      );
    }
    if (reason.includes('order_delete_protected_status')) {
      return NextResponse.json(
        { error: 'Un pedido pagado, despachado o completado no se puede eliminar. Debe conservarse su historial.' },
        { status: 409 },
      );
    }
    console.error('admin_order_delete_failed', { orderId: pedidoId, code: error.code || null });
    return NextResponse.json({ error: 'No se pudo eliminar el pedido de forma segura.' }, { status: 400 });
  }

  return NextResponse.json({ ok: true, data });
}
