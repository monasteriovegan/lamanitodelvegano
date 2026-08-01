'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerAuthClient } from '@/lib/supabase/server-auth';
import { requireRole } from '@/lib/supabase/require-role';

export async function crearCategoria(formData: FormData) {
  await requireRole(['admin']);
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
  await requireRole(['admin']);
  const supabase = await createSupabaseServerAuthClient();
  const { error } = await supabase.from('categorias').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/categorias');
  revalidatePath('/');
}
