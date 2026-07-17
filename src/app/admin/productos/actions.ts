'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentAdminUser, createSupabaseServerAuthClient } from '@/lib/supabase/server-auth';

async function requireAdmin() {
  const admin = await getCurrentAdminUser();
  if (!admin) throw new Error('No autorizado');
  return admin;
}

export async function guardarProducto(formData: FormData) {
  await requireAdmin();
  const supabase = await createSupabaseServerAuthClient();

  const id = formData.get('id') as string | null;
  const payload = {
    nombre: formData.get('nombre') as string,
    descripcion: formData.get('descripcion') as string,
    precio: parseInt(formData.get('precio') as string, 10),
    precio_anterior: formData.get('precio_anterior') ? parseInt(formData.get('precio_anterior') as string, 10) : null,
    categoria: (formData.get('categoria') as string) || null,
    emoji: (formData.get('emoji') as string) || '🌱',
    etiqueta: (formData.get('etiqueta') as string) || null,
    color_fondo: (formData.get('color_fondo') as string) || '#1B4332',
    imagen_url: (formData.get('imagen_url') as string) || null,
    maneja_stock: formData.get('maneja_stock') === 'on',
    stock: formData.get('stock') ? parseInt(formData.get('stock') as string, 10) : 0,
    gluten_free: formData.get('gluten_free') === 'on',
    nut_free: formData.get('nut_free') === 'on',
    gramaje: (formData.get('gramaje') as string) || null,
    variedades: (formData.get('variedades') as string) || null,
    activo: formData.get('activo') === 'on',
  };

  if (id) {
    const { error } = await supabase.from('productos').update(payload).eq('id', id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from('productos').insert(payload);
    if (error) throw new Error(error.message);
  }

  revalidatePath('/admin/productos');
  revalidatePath('/');
}

export async function toggleDestacado(id: string, valorActual: boolean) {
  await requireAdmin();
  const supabase = await createSupabaseServerAuthClient();
  const { error } = await supabase.from('productos').update({ destacado: !valorActual }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/productos');
  revalidatePath('/');
}

export async function eliminarProducto(id: string) {
  await requireAdmin();
  const supabase = await createSupabaseServerAuthClient();
  const { error } = await supabase.from('productos').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/productos');
  revalidatePath('/');
}
