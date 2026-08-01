'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/supabase/require-role';
import { guardarAjustesParcial } from '@/lib/ajustes/helpers';

export async function guardarPromoFlyer(formData: FormData) {
  await requireRole(['admin']);

  await guardarAjustesParcial({
    promo_activa: formData.get('promo_activa') === 'on',
    promo_imagen_url: (formData.get('promo_imagen_url') as string) || '',
    promo_producto_id: (formData.get('promo_producto_id') as string) || '',
  });

  revalidatePath('/admin/promo-flyer');
  revalidatePath('/');
}
