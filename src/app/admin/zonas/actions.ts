'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentAdminUser, createSupabaseServerAuthClient } from '@/lib/supabase/server-auth';

export async function crearZona(formData: FormData) {
  const admin = await getCurrentAdminUser();
  if (!admin) throw new Error('No autorizado');
  const supabase = await createSupabaseServerAuthClient();

  const { error } = await supabase.from('zonas').insert({
    nombre: formData.get('nombre') as string,
    comunas: formData.get('comunas') as string,
    precio: parseInt(formData.get('precio') as string, 10),
  });
  if (error) throw new Error(error.message);
  revalidatePath('/admin/zonas');
  revalidatePath('/');
}

export async function eliminarZona(id: string) {
  const admin = await getCurrentAdminUser();
  if (!admin) throw new Error('No autorizado');
  const supabase = await createSupabaseServerAuthClient();
  const { error } = await supabase.from('zonas').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/zonas');
  revalidatePath('/');
}
