'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerAuthClient } from '@/lib/supabase/server-auth';
import { requireRole } from '@/lib/supabase/require-role';
import { enviarEmail } from '@/lib/email/resend';
import { plantillaPedidoDespachado } from '@/lib/email/templates';
import type { EstadoPedido, Pedido } from '@/types/domain';

export async function cambiarEstadoPedido(id: string, nuevoEstado: EstadoPedido) {
  await requireRole(['admin', 'soporte', 'bodega']);

  const supabase = await createSupabaseServerAuthClient();
  const { data: pedido, error } = await supabase
    .from('pedidos')
    .update({ status: nuevoEstado })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);

  // Best-effort: el cambio de estado ya se guardó pase lo que pase con el
  // email. Un fallo de Resend no debe impedir que el pedido avance.
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
}
