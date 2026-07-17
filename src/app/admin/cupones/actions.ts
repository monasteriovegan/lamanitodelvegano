'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentAdminUser, createSupabaseServerAuthClient } from '@/lib/supabase/server-auth';

export async function crearCupon(formData: FormData) {
  const admin = await getCurrentAdminUser();
  if (!admin) throw new Error('No autorizado');
  const supabase = await createSupabaseServerAuthClient();

  const codigo = (formData.get('codigo') as string).toUpperCase().trim();
  const { error } = await supabase.from('cupones').insert({
    id: codigo,
    code: codigo,
    tipo: formData.get('tipo') as string,
    valor: formData.get('valor') as string,
    minMonto: formData.get('min_monto') ? parseInt(formData.get('min_monto') as string, 10) : 0,
    activo: true,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/admin/cupones');
}

export async function toggleCuponActivo(id: string, activoActual: boolean) {
  const admin = await getCurrentAdminUser();
  if (!admin) throw new Error('No autorizado');
  const supabase = await createSupabaseServerAuthClient();
  const { error } = await supabase.from('cupones').update({ activo: !activoActual }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/cupones');
}

export async function eliminarCupon(id: string) {
  const admin = await getCurrentAdminUser();
  if (!admin) throw new Error('No autorizado');
  const supabase = await createSupabaseServerAuthClient();
  const { error } = await supabase.from('cupones').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/cupones');
}
