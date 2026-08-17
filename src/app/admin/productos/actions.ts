'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerAuthClient } from '@/lib/supabase/server-auth';
import { requireRole } from '@/lib/supabase/require-role';
import { BusinessRepository } from '@/lib/repositories/business-repository';
import { slugify } from '@/lib/slugify';

// La BD todavía tiene UNIQUE(slug) global. Se conserva ese contrato durante la
// fase compatible; pasará a unicidad por negocio cuando el routing por tenant
// esté activo y todos los lectores de slug estén aislados.
async function slugUnico(
  supabase: Awaited<ReturnType<typeof createSupabaseServerAuthClient>>,
  base: string,
  idActual: string | null,
) {
  let intento = base;
  let sufijo = 2;
  for (;;) {
    const query = supabase.from('productos').select('id').eq('slug', intento).limit(1);
    const { data } = idActual ? await query.neq('id', idActual) : await query;
    if (!data || data.length === 0) return intento;
    intento = `${base}-${sufijo}`;
    sufijo++;
  }
}

export async function guardarProducto(formData: FormData) {
  await requireRole(['admin', 'bodega']);
  const supabase = await createSupabaseServerAuthClient();
  const business = await new BusinessRepository(supabase).requireDefault();

  const id = formData.get('id') as string | null;
  const nombre = formData.get('nombre') as string;
  const slugInput = (formData.get('slug') as string)?.trim();
  const slugBase = slugify(slugInput || nombre);
  const slug = await slugUnico(supabase, slugBase, id);

  const payload = {
    business_unit_id: business.id,
    nombre,
    slug,
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

    sku: (formData.get('sku') as string) || null,
    cost_price: formData.get('cost_price') ? parseInt(formData.get('cost_price') as string, 10) : null,
    low_stock_alert: formData.get('low_stock_alert') ? parseInt(formData.get('low_stock_alert') as string, 10) : null,
    weight_grams: formData.get('weight_grams') ? parseInt(formData.get('weight_grams') as string, 10) : null,
    is_new: formData.get('is_new') === 'on',
    is_featured: formData.get('is_featured') === 'on',
    story: (formData.get('story') as string) || null,
    ingredients: formData.get('ingredients')
      ? (formData.get('ingredients') as string)
          .split(',')
          .map((i: string) => i.trim())
          .filter(Boolean)
      : null,
    allergens: formData.get('allergens')
      ? (formData.get('allergens') as string)
          .split(',')
          .map((i: string) => i.trim())
          .filter(Boolean)
      : null,
  };

  if (id) {
    const { error } = await supabase.from('productos')
      .update(payload)
      .eq('id', id)
      .eq('business_unit_id', business.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from('productos').insert(payload);
    if (error) throw new Error(error.message);
  }

  revalidatePath('/admin/productos');
  revalidatePath('/');
}

export async function toggleDestacado(id: string, valorActual: boolean) {
  await requireRole(['admin']);
  const supabase = await createSupabaseServerAuthClient();
  const business = await new BusinessRepository(supabase).requireDefault();
  const { error } = await supabase.from('productos')
    .update({ destacado: !valorActual })
    .eq('id', id)
    .eq('business_unit_id', business.id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/productos');
  revalidatePath('/');
}

export async function eliminarProducto(id: string) {
  await requireRole(['admin', 'bodega']);
  const supabase = await createSupabaseServerAuthClient();
  const business = await new BusinessRepository(supabase).requireDefault();
  const { error } = await supabase.from('productos')
    .delete()
    .eq('id', id)
    .eq('business_unit_id', business.id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/productos');
  revalidatePath('/');
}
