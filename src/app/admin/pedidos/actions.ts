'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/supabase/require-role';
import { enviarEmail } from '@/lib/email/resend';
import { plantillaPedidoDespachado } from '@/lib/email/templates';
import type { EstadoPedido, Pedido } from '@/types/domain';
import { OrderRepository, normalizeOrderStatus } from '@/lib/repositories/orders-repository';

export async function cambiarEstadoPedido(id: string, nuevoEstado: EstadoPedido) {
  await requireRole(['admin', 'soporte', 'bodega']);

  const supabase = createSupabaseServiceClient();
  const pedido = await new OrderRepository(supabase).update(id, { status: normalizeOrderStatus(nuevoEstado) });

  // Enviar email de despacho
  if (nuevoEstado === 'Despachado' && pedido.cliente?.email) {
    enviarEmail({
      to: pedido.cliente.email,
      subject: `Tu pedido #${id.slice(0, 8)} va en camino 🚚`,
      html: plantillaPedidoDespachado(pedido as unknown as Pedido),
    }).then((res) => {
      if (!res.ok) console.error('No se pudo enviar email de despacho:', res.error);
    });
  }

  revalidatePath('/admin/pedidos');
  revalidatePath('/admin');
}

export async function guardarPedidoGestion(
  id: string,
  nuevoEstado: EstadoPedido,
  trackingNumber: string,
  adminNotes: string
) {
  await requireRole(['admin', 'soporte', 'bodega']);

  const supabase = createSupabaseServiceClient();
  const pedido = await new OrderRepository(supabase).update(id, {
    status: normalizeOrderStatus(nuevoEstado),
    tracking_number: trackingNumber,
    admin_notes: adminNotes,
  });

  // Enviar email de despacho
  if (nuevoEstado === 'Despachado' && pedido?.cliente?.email) {
    enviarEmail({
      to: pedido.cliente.email,
      subject: `Tu pedido #${id.slice(0, 8)} va en camino 🚚`,
      html: plantillaPedidoDespachado(pedido as unknown as Pedido),
    }).then((res) => {
      if (!res.ok) console.error('No se pudo enviar email de despacho:', res.error);
    });
  }

  revalidatePath(`/admin/pedidos/${id}`);
  revalidatePath('/admin/pedidos');
  revalidatePath('/admin');
}
