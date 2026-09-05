'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
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

function parseTriState(val: FormDataEntryValue | null): boolean | null {
  if (val === 'true') return true;
  if (val === 'false') return false;
  return null;
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
    gluten_free: parseTriState(formData.get('gluten_free')),
    nut_free: parseTriState(formData.get('nut_free')),
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

  let savedId = id;
  if (id) {
    const { error } = await supabase.from('productos')
      .update(payload)
      .eq('id', id)
      .eq('business_unit_id', business.id);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await supabase
      .from('productos')
      .insert(payload)
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    savedId = String(data.id);
  }

  revalidatePath('/admin/productos');
  revalidatePath('/');
  redirect(`/admin/productos/${savedId}?saved=1`);
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

/**
 * El historial de carrito usa FK RESTRICT hacia productos. Si el producto ya
 * participó en un carrito, "Eliminar" lo archiva (activo=false) para no destruir
 * trazabilidad. Solo se hace hard-delete cuando no existen referencias; si otra
 * FK protegida aparece entre el chequeo y el delete, el fallback también archiva.
 */
export async function eliminarProducto(id: string) {
  await requireRole(['admin', 'bodega']);
  const supabase = await createSupabaseServerAuthClient();
  const business = await new BusinessRepository(supabase).requireDefault();

  const { data: cartRefs, error: cartRefError } = await supabase
    .from('cart_items')
    .select('id')
    .eq('product_id', id)
    .limit(1);
  if (cartRefError) throw new Error(cartRefError.message);

  const archivar = async () => {
    const { error } = await supabase.from('productos')
      .update({ activo: false })
      .eq('id', id)
      .eq('business_unit_id', business.id);
    if (error) throw new Error(error.message);
  };

  if ((cartRefs || []).length > 0) {
    await archivar();
  } else {
    const { error } = await supabase.from('productos')
      .delete()
      .eq('id', id)
      .eq('business_unit_id', business.id);
    if (error?.code === '23503') {
      await archivar();
    } else if (error) {
      throw new Error(error.message);
    }
  }

  revalidatePath('/admin/productos');
  revalidatePath('/');
}
