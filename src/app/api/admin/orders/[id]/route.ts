import { NextResponse } from 'next/server';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { getCurrentAdminUser } from '@/lib/supabase/server-auth';

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

  const now = new Date().toISOString();

  // Construcción de actualización para la tabla canónica `orders`
  const orderUpdate: Record<string, any> = { updated_at: now };
  if (body.status !== undefined) {
    orderUpdate.status = body.status;
    if (body.status === 'shipped') orderUpdate.shipped_at = now;
    if (body.status === 'delivered') orderUpdate.delivered_at = now;
  }

  if (body.payment_status !== undefined) {
    orderUpdate.payment_status = body.payment_status;
    if (body.payment_status === 'paid') orderUpdate.paid_at = now;
  }

  if (body.tracking_number !== undefined) orderUpdate.tracking_number = body.tracking_number;
  if (body.admin_notes !== undefined) orderUpdate.admin_notes = body.admin_notes;

  // 1. Actualizar en `orders`
  const { data: updatedOrder, error: orderErr } = await db
    .from('orders')
    .update(orderUpdate)
    .eq('id', id)
    .select()
    .maybeSingle();

  // 2. Registrar en `order_status_history`
  if (updatedOrder) {
    await db.from('order_status_history').insert({
      order_id: updatedOrder.id,
      status: body.status || updatedOrder.status,
      payment_status: body.payment_status || updatedOrder.payment_status,
      notes: body.admin_notes || 'Actualización desde panel administrativo',
      created_by: admin.email || 'admin',
    });
  }

  // 3. Mantener compatibilidad dual actualizando `pedidos` legado
  const legacyUpdate: Record<string, any> = { updatedAt: now };
  if (body.status !== undefined) {
    const statusMap: Record<string, string> = {
      pending: 'Pendiente',
      confirmed: 'Pagado',
      processing: 'Pagado',
      shipped: 'Despachado',
      delivered: 'Completado',
      cancelled: 'Cancelado',
    };
    legacyUpdate.status = statusMap[body.status] || body.status;
  }
  if (body.payment_status !== undefined) legacyUpdate.payment_status = body.payment_status;
  if (body.tracking_number !== undefined) legacyUpdate.tracking_number = body.tracking_number;
  if (body.admin_notes !== undefined) legacyUpdate.admin_notes = body.admin_notes;

  await db.from('pedidos').update(legacyUpdate).eq('id', id);

  return NextResponse.json({ ok: true, data: updatedOrder });
}
