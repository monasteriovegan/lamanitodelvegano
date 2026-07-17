'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentAdminUser, createSupabaseServerAuthClient } from '@/lib/supabase/server-auth';

export async function crearCategoria(formData: FormData) {
  const admin = await getCurrentAdminUser();
  if (!admin) throw new Error('No autorizado');
  const supabase = await createSupabaseServerAuthClient();

  const nombre = formData.get('nombre') as string;
  const emoji = (formData.get('emoji') as string) || '🌱';
  const slug = nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  const { error } = await supabase.from('categorias').insert({ nombre, emoji, slug });
  if (error) throw new Error(error.message);
  revalidatePath('/admin/categorias');
  revalidatePath('/');
}

export async function eliminarCategoria(id: string) {
  const admin = await getCurrentAdminUser();
  if (!admin) throw new Error('No autorizado');
  const supabase = await createSupabaseServerAuthClient();
  const { error } = await supabase.from('categorias').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/categorias');
  revalidatePath('/');
}
