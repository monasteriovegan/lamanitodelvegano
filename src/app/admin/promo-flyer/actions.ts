'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/supabase/require-role';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { BusinessRepository } from '@/lib/repositories/business-repository';
import { guardarAjustesParcial } from '@/lib/ajustes/helpers';

export async function guardarPromoFlyer(formData: FormData) {
  await requireRole(['admin']);
  const productId = String(formData.get('promo_producto_id') || '').trim();

  if (productId) {
    const db = createSupabaseServiceClient();
    const business = await new BusinessRepository(db).requireDefault();
    const { data } = await db.from('productos')
      .select('id')
      .eq('id', productId)
      .eq('business_unit_id', business.id)
      .eq('activo', true)
      .maybeSingle();
    if (!data) throw new Error('El producto promocionado no pertenece al negocio actual.');
  }

  await guardarAjustesParcial({
    promo_activa: formData.get('promo_activa') === 'on',
    promo_imagen_url: String(formData.get('promo_imagen_url') || ''),
    promo_producto_id: productId,
  });

  revalidatePath('/admin/promo-flyer');
  revalidatePath('/');
}
