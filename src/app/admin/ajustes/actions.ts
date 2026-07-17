'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentAdminUser, createSupabaseServerAuthClient } from '@/lib/supabase/server-auth';

export async function guardarAjustes(formData: FormData) {
  const admin = await getCurrentAdminUser();
  if (!admin) throw new Error('No autorizado');
  const supabase = await createSupabaseServerAuthClient();

  const data = {
    nombre: formData.get('nombre') as string,
    whatsapp: formData.get('whatsapp') as string,
    instagram: formData.get('instagram') as string,
    tiktok: formData.get('tiktok') as string,
    facebook: formData.get('facebook') as string,
    estado: formData.get('estado') as string,
    tasaPuntos: parseInt(formData.get('tasa_puntos') as string, 10),
    valorPunto: parseInt(formData.get('valor_punto') as string, 10),
  };

  const { error } = await supabase.from('ajustes').upsert({ id: 'global', data });
  if (error) throw new Error(error.message);
  revalidatePath('/admin/ajustes');
  revalidatePath('/');
}
