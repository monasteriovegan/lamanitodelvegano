'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerAuthClient } from '@/lib/supabase/server-auth';
import { requireRole } from '@/lib/supabase/require-role';

function zonePayload(formData: FormData) {
  const nombre = String(formData.get('nombre') || '').trim();
  const comunas = String(formData.get('comunas') || '').trim();
  const precio = Number.parseInt(String(formData.get('precio') || ''), 10);
  if (!nombre) throw new Error('El nombre de la zona es obligatorio.');
  if (!Number.isInteger(precio) || precio < 0) throw new Error('El precio de despacho debe ser un entero mayor o igual a 0.');
  return { nombre, comunas: comunas || null, precio };
}

function revalidateShipping() {
  revalidatePath('/admin/zonas');
  revalidatePath('/checkout');
  revalidatePath('/');
}

export async function crearZona(formData: FormData) {
  await requireRole(['admin']);
  const supabase = await createSupabaseServerAuthClient();
  const { error } = await supabase.from('zonas').insert(zonePayload(formData));
  if (error) throw new Error(error.message);
  revalidateShipping();
}

export async function actualizarZona(formData: FormData) {
  await requireRole(['admin']);
  const supabase = await createSupabaseServerAuthClient();
  const id = String(formData.get('id') || '').trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Zona inválida.');
  const { error } = await supabase.from('zonas').update(zonePayload(formData)).eq('id', id);
  if (error) throw new Error(error.message);
  revalidateShipping();
}

export async function eliminarZona(id: string) {
  await requireRole(['admin']);
  const supabase = await createSupabaseServerAuthClient();
  const { error } = await supabase.from('zonas').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidateShipping();
}
