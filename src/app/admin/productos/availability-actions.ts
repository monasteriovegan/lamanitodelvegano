'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/supabase/require-role';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { BusinessRepository } from '@/lib/repositories/business-repository';

export async function guardarDisponibilidadProducto(productId: string, dates: string[]) {
  await requireRole(['admin', 'bodega']);
  const normalized = Array.from(new Set((dates || [])
    .map((value) => String(value || '').trim())
    .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value))))
    .sort();
  if (normalized.length > 60) throw new Error('Demasiadas fechas de entrega.');

  const db = createSupabaseServiceClient();
  const business = await new BusinessRepository(db).requireDefault();
  const { data, error } = await db
    .from('productos')
    .update({ disponibilidad: normalized.join(',') })
    .eq('id', productId)
    .eq('business_unit_id', business.id)
    .select('id,disponibilidad')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Producto no encontrado.');

  revalidatePath(`/admin/productos/${productId}`);
  revalidatePath('/admin/productos');
  revalidatePath('/checkout');
  return { ok: true, disponibilidad: String(data.disponibilidad || '') };
}
