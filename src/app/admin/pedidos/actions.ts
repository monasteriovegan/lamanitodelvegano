'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/supabase/require-role';
import { enviarEmail } from '@/lib/email/resend';
import { plantillaPedidoDespachado } from '@/lib/email/templates';
import type { EstadoPedido, Pedido } from '@/types/domain';

export async function cambiarEstadoPedido(id: string, nuevoEstado: EstadoPedido) {
  await requireRole(['admin', 'soporte', 'bodega']);

  const supabase = createSupabaseServiceClient();

  // Obtener estado anterior
  const { data: oldPedido } = await supabase.from('pedidos').select('status').eq('id', id).single();

  const { data: pedido, error } = await supabase
    .from('pedidos')
    .update({ status: nuevoEstado })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);

  // Registrar en historial
  if (oldPedido && oldPedido.status !== nuevoEstado) {
    await supabase.from('order_status_history').insert({
      pedido_id: id,
      old_status: oldPedido.status,
      new_status: nuevoEstado,
      notes: `Estado cambiado rápidamente desde el listado`,
    });
  }

  // Enviar email de despacho
  if (nuevoEstado === 'Despachado' && pedido?.cliente?.email) {
    enviarEmail({
      to: pedido.cliente.email,
      subject: `Tu pedido #${id.slice(0, 8)} va en camino 🚚`,
      html: plantillaPedidoDespachado(pedido as Pedido),
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

  // Obtener estado anterior
  const { data: oldPedido } = await supabase.from('pedidos').select('status').eq('id', id).single();

  const { data: pedido, error } = await supabase
    .from('pedidos')
    .update({
      status: nuevoEstado,
      tracking_number: trackingNumber || null,
      admin_notes: adminNotes || null,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);

  // Registrar en historial
  if (oldPedido && oldPedido.status !== nuevoEstado) {
    await supabase.from('order_status_history').insert({
      pedido_id: id,
      old_status: oldPedido.status,
      new_status: nuevoEstado,
      notes: 'Actualización en ficha técnica',
    });
  }

  // Enviar email de despacho
  if (nuevoEstado === 'Despachado' && pedido?.cliente?.email) {
    enviarEmail({
      to: pedido.cliente.email,
      subject: `Tu pedido #${id.slice(0, 8)} va en camino 🚚`,
      html: plantillaPedidoDespachado(pedido as Pedido),
    }).then((res) => {
      if (!res.ok) console.error('No se pudo enviar email de despacho:', res.error);
    });
  }

  revalidatePath(`/admin/pedidos/${id}`);
  revalidatePath('/admin/pedidos');
  revalidatePath('/admin');
}
