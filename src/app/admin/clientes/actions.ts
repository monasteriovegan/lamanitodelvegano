'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/supabase/require-role';

const ESTADO_CRM_LABEL: Record<string, string> = {
  new: 'Nuevo',
  contacted: 'Contactado',
  interested: 'Interesado',
  order_started: 'Pedido Iniciado',
  payment_pending: 'Pago Pendiente',
  customer: 'Cliente',
  follow_up: 'Seguimiento',
  repeat_customer: 'Cliente Frecuente',
  inactive: 'Inactivo',
  lost: 'Perdido',
};

export async function cambiarEstadoCrm(customerId: string, nuevoEstado: string) {
  const admin = await requireRole(['admin', 'soporte']);
  const supabase = createSupabaseServiceClient();

  const { data: oldCustomer } = await supabase
    .from('customers')
    .select('crm_status')
    .eq('id', customerId)
    .single();
  const oldStatus = oldCustomer?.crm_status;

  const { error } = await supabase
    .from('customers')
    .update({ crm_status: nuevoEstado, updated_at: new Date().toISOString() })
    .eq('id', customerId);

  if (error) throw new Error(error.message);

  const oldLabel = oldStatus ? ESTADO_CRM_LABEL[oldStatus] || oldStatus : 'Ninguno';
  const newLabel = ESTADO_CRM_LABEL[nuevoEstado] || nuevoEstado;

  await supabase.from('crm_activities').insert({
    customer_id: customerId,
    type: 'status_change',
    description: `Cambió etapa CRM de "${oldLabel}" a "${newLabel}"`,
    created_by: admin.id,
  });

  revalidatePath(`/admin/clientes/${customerId}`);
  revalidatePath('/admin/clientes');
}

export async function crearClienteNota(customerId: string, content: string) {
  const admin = await requireRole(['admin', 'soporte']);
  const supabase = createSupabaseServiceClient();

  const { error: noteError } = await supabase.from('customer_notes').insert({
    customer_id: customerId,
    content,
    created_by: admin.id,
  });

  if (noteError) throw new Error(noteError.message);

  await supabase.from('crm_activities').insert({
    customer_id: customerId,
    type: 'note_added',
    description: `Añadió nota: "${content.substring(0, 45)}${content.length > 45 ? '...' : ''}"`,
    created_by: admin.id,
  });

  revalidatePath(`/admin/clientes/${customerId}`);
}

export async function eliminarClienteNota(noteId: string, customerId: string) {
  const admin = await requireRole(['admin', 'soporte']);
  const supabase = createSupabaseServiceClient();

  const { error } = await supabase.from('customer_notes').delete().eq('id', noteId);
  if (error) throw new Error(error.message);

  await supabase.from('crm_activities').insert({
    customer_id: customerId,
    type: 'note_deleted',
    description: `Eliminó una nota interna`,
    created_by: admin.id,
  });

  revalidatePath(`/admin/clientes/${customerId}`);
}

export async function agregarClienteTag(customerId: string, tagId: string) {
  const admin = await requireRole(['admin', 'soporte']);
  const supabase = createSupabaseServiceClient();

  const { data: tag } = await supabase.from('customer_tags').select('name').eq('id', tagId).single();

  const { error } = await supabase.from('customer_tag_assignments').insert({
    customer_id: customerId,
    tag_id: tagId,
  });

  if (error) throw new Error(error.message);

  await supabase.from('crm_activities').insert({
    customer_id: customerId,
    type: 'tag_added',
    description: `Agregó etiqueta: "${tag?.name || 'desconocida'}"`,
    created_by: admin.id,
  });

  revalidatePath(`/admin/clientes/${customerId}`);
}

export async function quitarClienteTag(customerId: string, tagId: string) {
  const admin = await requireRole(['admin', 'soporte']);
  const supabase = createSupabaseServiceClient();

  const { data: tag } = await supabase.from('customer_tags').select('name').eq('id', tagId).single();

  const { error } = await supabase
    .from('customer_tag_assignments')
    .delete()
    .eq('customer_id', customerId)
    .eq('tag_id', tagId);

  if (error) throw new Error(error.message);

  await supabase.from('crm_activities').insert({
    customer_id: customerId,
    type: 'tag_removed',
    description: `Quitó etiqueta: "${tag?.name || 'desconocida'}"`,
    created_by: admin.id,
  });

  revalidatePath(`/admin/clientes/${customerId}`);
}
