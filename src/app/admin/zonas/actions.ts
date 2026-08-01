'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerAuthClient } from '@/lib/supabase/server-auth';
import { requireRole } from '@/lib/supabase/require-role';

export async function crearZona(formData: FormData) {
  await requireRole(['admin']);
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
  await requireRole(['admin']);
  const supabase = await createSupabaseServerAuthClient();
  const { error } = await supabase.from('zonas').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/zonas');
  revalidatePath('/');
}
