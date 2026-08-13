'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/supabase/require-role';
import { CustomerRepository } from '@/lib/repositories/customers-repository';

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
  const repository = new CustomerRepository(supabase);
  const oldCustomer = await repository.getById(customerId);
  const oldStatus = oldCustomer?.crm_status;

  await repository.update(customerId, { crm_status: nuevoEstado });

  const oldLabel = oldStatus ? ESTADO_CRM_LABEL[oldStatus] || oldStatus : 'Ninguno';
  const newLabel = ESTADO_CRM_LABEL[nuevoEstado] || nuevoEstado;

  await repository.addActivity(customerId, {
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
  const repository = new CustomerRepository(supabase);
  await repository.addNote(customerId, content, admin.id);
  await repository.addActivity(customerId, {
    type: 'note_added',
    description: `Añadió nota: "${content.substring(0, 45)}${content.length > 45 ? '...' : ''}"`,
    created_by: admin.id,
  });

  revalidatePath(`/admin/clientes/${customerId}`);
}

export async function eliminarClienteNota(noteId: string, customerId: string) {
  const admin = await requireRole(['admin', 'soporte']);
  const supabase = createSupabaseServiceClient();
  const repository = new CustomerRepository(supabase);
  await repository.deleteNote(noteId);
  await repository.addActivity(customerId, {
    type: 'note_deleted',
    description: `Eliminó una nota interna`,
    created_by: admin.id,
  });

  revalidatePath(`/admin/clientes/${customerId}`);
}

export async function agregarClienteTag(customerId: string, tagId: string) {
  const admin = await requireRole(['admin', 'soporte']);
  const supabase = createSupabaseServiceClient();
  const repository = new CustomerRepository(supabase);
  const tagName = await repository.assignTag(customerId, tagId);
  await repository.addActivity(customerId, {
    type: 'tag_added',
    description: `Agregó etiqueta: "${tagName || 'desconocida'}"`,
    created_by: admin.id,
  });

  revalidatePath(`/admin/clientes/${customerId}`);
}

export async function quitarClienteTag(customerId: string, tagId: string) {
  const admin = await requireRole(['admin', 'soporte']);
  const supabase = createSupabaseServiceClient();
  const repository = new CustomerRepository(supabase);
  const tagName = await repository.unassignTag(customerId, tagId);
  await repository.addActivity(customerId, {
    type: 'tag_removed',
    description: `Quitó etiqueta: "${tagName || 'desconocida'}"`,
    created_by: admin.id,
  });

  revalidatePath(`/admin/clientes/${customerId}`);
}
