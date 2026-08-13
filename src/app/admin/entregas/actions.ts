'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/supabase/require-role';
import { DeliveryRepository } from '@/lib/repositories/delivery-repository';

export async function guardarConfiguracionEntregas(formData: FormData) {
  await requireRole(['admin']);
  const supabase = createSupabaseServiceClient();

  // Recopilar dias habilitados (del 0 al 6)
  const weekdays: number[] = [];
  for (let i = 0; i < 7; i++) {
    if (formData.get(`day_${i}`) === 'on') {
      weekdays.push(i);
    }
  }

  const payload = {
    enabled_weekdays: weekdays,
    min_advance_days: parseInt(formData.get('min_advance_days') as string, 10) || 3,
    max_advance_days: parseInt(formData.get('max_advance_days') as string, 10) || 21,
    cutoff_hour: parseInt(formData.get('cutoff_hour') as string, 10) || 12,
    delivery_message: (formData.get('delivery_message') as string) || 'Elige tu fecha de entrega preferida ✦',
    max_orders_per_day: parseInt(formData.get('max_orders_per_day') as string, 10) || 0,
    updated_at: new Date().toISOString(),
  };

  await new DeliveryRepository(supabase).saveSettings(payload);

  revalidatePath('/admin/entregas');
  revalidatePath('/checkout');
}

export async function bloquearFechaEntrega(formData: FormData) {
  await requireRole(['admin']);
  const supabase = createSupabaseServiceClient();

  const date = formData.get('date') as string;
  const reason = formData.get('reason') as string;

  if (!date) throw new Error('Debe proveer una fecha.');

  await new DeliveryRepository(supabase).blockDate({ date, reason: reason || null });

  revalidatePath('/admin/entregas');
  revalidatePath('/checkout');
}

export async function desbloquearFechaEntrega(id: string) {
  await requireRole(['admin']);
  const supabase = createSupabaseServiceClient();

  await new DeliveryRepository(supabase).unblockDate(id);

  revalidatePath('/admin/entregas');
  revalidatePath('/checkout');
}
