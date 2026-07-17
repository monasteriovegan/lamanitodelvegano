import { createSupabaseServiceClient } from '@/lib/supabase/server';
import type { Producto, Categoria, Zona, AjustesPublicos } from '@/types/domain';

/**
 * Adaptado a la estructura REAL de la BD (compartida con el sitio viejo):
 * - productos.categoria es texto libre, no FK a categorias.id
 * - productos.descripcion es una sola columna, no corta/larga
 * - ajustes guarda todo en una columna `data` jsonb
 */

export async function getProductosActivos(): Promise<Producto[]> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from('productos')
    .select('*')
    .eq('activo', true)
    .order('destacado', { ascending: false });

  if (error) {
    console.error('Error cargando productos:', error);
    return [];
  }
  return data as Producto[];
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

export async function getProductoById(id: string): Promise<Producto | null> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.from('productos').select('*').eq('id', id).eq('activo', true).maybeSingle();

  if (error || !data) return null;
  return data as Producto;
}
