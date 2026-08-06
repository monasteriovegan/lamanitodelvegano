'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/supabase/require-role';

export async function guardarConfiguracionEntregas(formData: FormData) {
  await requireRole(['admin']);
  const supabase = createSupabaseServiceClient();

  // Obtener negocio
  const { data: biz } = await supabase
    .from('businesses')
    .select('id')
    .eq('slug', 'la-manito-del-vegano')
    .maybeSingle();
  if (!biz) throw new Error('Negocio por defecto no encontrado');
  const businessId = biz.id;

  // Recopilar dias habilitados (del 0 al 6)
  const weekdays: number[] = [];
  for (let i = 0; i < 7; i++) {
    if (formData.get(`day_${i}`) === 'on') {
      weekdays.push(i);
    }
  }

  const payload = {
    business_id: businessId,
    enabled_weekdays: weekdays,
    min_advance_days: parseInt(formData.get('min_advance_days') as string, 10) || 3,
    max_advance_days: parseInt(formData.get('max_advance_days') as string, 10) || 21,
    cutoff_hour: parseInt(formData.get('cutoff_hour') as string, 10) || 12,
    delivery_message: (formData.get('delivery_message') as string) || 'Elige tu fecha de entrega preferida ✦',
    max_orders_per_day: parseInt(formData.get('max_orders_per_day') as string, 10) || 0,
    updated_at: new Date().toISOString(),
  };

  const { data: existing } = await supabase
    .from('delivery_settings')
    .select('id')
    .eq('business_id', businessId)
    .maybeSingle();

  let error = null;
  if (existing) {
    const res = await supabase.from('delivery_settings').update(payload).eq('id', existing.id);
    error = res.error;
  } else {
    const res = await supabase.from('delivery_settings').insert(payload);
    error = res.error;
  }

  if (error) throw new Error(error.message);

  revalidatePath('/admin/entregas');
  revalidatePath('/checkout');
}

export async function bloquearFechaEntrega(formData: FormData) {
  await requireRole(['admin']);
  const supabase = createSupabaseServiceClient();

  const { data: biz } = await supabase
    .from('businesses')
    .select('id')
    .eq('slug', 'la-manito-del-vegano')
    .maybeSingle();
  if (!biz) throw new Error('Negocio por defecto no encontrado');
  const businessId = biz.id;

  const date = formData.get('date') as string;
  const reason = formData.get('reason') as string;

  if (!date) throw new Error('Debe proveer una fecha.');

  const { error } = await supabase.from('blocked_delivery_dates').insert({
    business_id: businessId,
    date,
    reason: reason || null,
  });

  if (error) throw new Error(error.message);

  revalidatePath('/admin/entregas');
  revalidatePath('/checkout');
}

export async function desbloquearFechaEntrega(id: string) {
  await requireRole(['admin']);
  const supabase = createSupabaseServiceClient();

  const { error } = await supabase.from('blocked_delivery_dates').delete().eq('id', id);

  if (error) throw new Error(error.message);

  revalidatePath('/admin/entregas');
  revalidatePath('/checkout');
}
