'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/supabase/require-role';
import { guardarAjustesParcial } from '@/lib/ajustes/helpers';

export async function guardarAjustes(formData: FormData) {
  await requireRole(['admin']);

  await guardarAjustesParcial({
    nombre: formData.get('nombre') as string,
    whatsapp: formData.get('whatsapp') as string,
    instagram: formData.get('instagram') as string,
    tiktok: formData.get('tiktok') as string,
    facebook: formData.get('facebook') as string,
    estado: formData.get('estado') as 'abierto' | 'cerrado',
    tasaPuntos: parseInt(formData.get('tasa_puntos') as string, 10) || 1000,
    valorPunto: parseInt(formData.get('valor_punto') as string, 10) || 100,
    
    // Parity fields
    contact_email: formData.get('contact_email') as string,
    contact_phone: formData.get('contact_phone') as string,
    contact_address: formData.get('contact_address') as string,
    contact_city: formData.get('contact_city') as string,
    youtube: formData.get('youtube') as string,
    pinterest: formData.get('pinterest') as string,
    business_hours: formData.get('business_hours') as string,
    banner_enabled: formData.get('banner_enabled') === 'true' || formData.get('banner_enabled') === 'on',
    banner_text: formData.get('banner_text') as string,
    banner_color: formData.get('banner_color') as string,
    transfer_bank_name: formData.get('transfer_bank_name') as string,
    transfer_account_type: formData.get('transfer_account_type') as string,
    transfer_account_holder: formData.get('transfer_account_holder') as string,
    transfer_account_rut: formData.get('transfer_account_rut') as string,
    transfer_account_number: formData.get('transfer_account_number') as string,
    transfer_email: formData.get('transfer_email') as string,
    transfer_instructions: formData.get('transfer_instructions') as string,
    meta_title: formData.get('meta_title') as string,
    meta_description: formData.get('meta_description') as string,
    og_image_url: formData.get('og_image_url') as string,
  });

  revalidatePath('/admin/ajustes');
  revalidatePath('/');
}
