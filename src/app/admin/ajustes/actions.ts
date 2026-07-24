'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentAdminUser } from '@/lib/supabase/server-auth';
import { guardarAjustesParcial } from '@/lib/ajustes/helpers';

export async function guardarAjustes(formData: FormData) {
  const admin = await getCurrentAdminUser();
  if (!admin) throw new Error('No autorizado');

  await guardarAjustesParcial({
    nombre: formData.get('nombre') as string,
    whatsapp: formData.get('whatsapp') as string,
    instagram: formData.get('instagram') as string,
    tiktok: formData.get('tiktok') as string,
    facebook: formData.get('facebook') as string,
    estado: formData.get('estado') as 'abierto' | 'cerrado',
    tasaPuntos: parseInt(formData.get('tasa_puntos') as string, 10),
    valorPunto: parseInt(formData.get('valor_punto') as string, 10),
  });

  revalidatePath('/admin/ajustes');
  revalidatePath('/');
}
