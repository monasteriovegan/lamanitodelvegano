import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { BusinessRepository } from '@/lib/repositories/business-repository';
import type { Producto, Categoria, Zona, AjustesPublicos } from '@/types/domain';

/**
 * Adaptado a la estructura REAL de la BD (compartida con el sitio viejo):
 * - productos.categoria es texto libre, no FK a categorias.id
 * - productos.descripcion es una sola columna, no corta/larga
 * - ajustes guarda todo en una columna `data` jsonb
 *
 * El storefront actual corresponde a la unidad canónica La Manito. Cuando exista
 * routing por businessSlug, estas funciones podrán recibir el businessUnitId activo.
 */

async function resolveBusinessUnitId(explicit?: string | null) {
  if (explicit) return explicit;
  const supabase = createSupabaseServiceClient();
  return (await new BusinessRepository(supabase).requireDefault()).id;
}

export async function getProductosActivos(businessUnitId?: string | null): Promise<Producto[]> {
  const supabase = createSupabaseServiceClient();
  const businessId = await resolveBusinessUnitId(businessUnitId);
  const { data, error } = await supabase
    .from('productos')
    .select('*')
    .eq('business_unit_id', businessId)
    .eq('activo', true)
    .order('destacado', { ascending: false });

  if (error) {
    console.error('Error cargando productos:', error);
    return [];
  }
  return (data || []).filter((p: any) => !/prueba/i.test(p.slug || '') && !/prueba/i.test(p.nombre || '')) as Producto[];
}

export async function getCategorias(): Promise<Categoria[]> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.from('categorias').select('id, nombre, emoji, slug');
  if (error) {
    console.error('Error cargando categorías:', error);
    return [];
  }
  return data as Categoria[];
}

export async function getZonas(): Promise<Zona[]> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.from('zonas').select('id, nombre, comunas, precio');
  if (error) {
    console.error('Error cargando zonas:', error);
    return [];
  }
  return data as Zona[];
}

export async function getAjustesPublicos(): Promise<AjustesPublicos | null> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.from('ajustes').select('id, data').eq('id', 'global').maybeSingle();

  if (error) {
    console.error('Error cargando ajustes:', error);
    return null;
  }
  return data as AjustesPublicos | null;
}

export async function getProductoById(id: string, businessUnitId?: string | null): Promise<Producto | null> {
  const supabase = createSupabaseServiceClient();
  const businessId = await resolveBusinessUnitId(businessUnitId);
  const { data, error } = await supabase
    .from('productos')
    .select('*')
    .eq('id', id)
    .eq('business_unit_id', businessId)
    .eq('activo', true)
    .maybeSingle();

  if (error || !data) return null;
  return data as Producto;
}

export async function getProductoBySlug(slug: string, businessUnitId?: string | null): Promise<Producto | null> {
  const supabase = createSupabaseServiceClient();
  const businessId = await resolveBusinessUnitId(businessUnitId);
  const { data, error } = await supabase
    .from('productos')
    .select('*')
    .eq('slug', slug)
    .eq('business_unit_id', businessId)
    .eq('activo', true)
    .maybeSingle();

  if (error || !data || /prueba/i.test(data.slug || '') || /prueba/i.test(data.nombre || '')) return null;
  return data as Producto;
}
