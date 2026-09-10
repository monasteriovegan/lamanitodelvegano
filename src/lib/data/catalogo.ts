import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { BusinessRepository } from '@/lib/repositories/business-repository';
import type { Producto, Categoria, Zona, AjustesPublicos } from '@/types/domain';
import type { CatalogOptionGroup, CatalogVariant } from '@/lib/catalog/types';

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

function mapCanonicalVariant(row: any): CatalogVariant {
  return {
    id: String(row.id),
    productId: String(row.product_id),
    sku: String(row.sku),
    name: String(row.name),
    price: Number(row.price || 0),
    compareAtPrice: row.compare_at_price === null || row.compare_at_price === undefined ? null : Number(row.compare_at_price),
    weightGrams: row.weight_grams === null || row.weight_grams === undefined ? null : Number(row.weight_grams),
    unitsIncluded: Number(row.units_included || 1),
    selectionQuantity: Number(row.selection_quantity || 0),
    managesStock: Boolean(row.manages_stock),
    stock: row.stock === null || row.stock === undefined ? null : Number(row.stock),
    active: row.is_active !== false,
    sortOrder: Number(row.sort_order || 0),
    imageUrl: row.image_url || null,
  };
}

function mapCanonicalOptionGroup(row: any): CatalogOptionGroup {
  return {
    id: String(row.id),
    productId: String(row.product_id),
    code: String(row.code),
    name: String(row.name),
    selectionMode: row.selection_mode === 'single' ? 'single' : 'quantity',
    required: Boolean(row.is_required),
    active: row.is_active !== false,
    sortOrder: Number(row.sort_order || 0),
    values: (Array.isArray(row.product_option_values) ? row.product_option_values : [])
      .filter((value: any) => value.is_active !== false)
      .map((value: any) => ({
        id: String(value.id),
        optionGroupId: String(value.option_group_id),
        code: String(value.code),
        label: String(value.label),
        priceDelta: Number(value.price_delta || 0),
        active: value.is_active !== false,
        sortOrder: Number(value.sort_order || 0),
      }))
      .sort((a: any, b: any) => a.sortOrder - b.sortOrder),
  };
}

function mapStorefrontProduct(row: any): Producto {
  const variants = (Array.isArray(row.product_variants) ? row.product_variants : [])
    .filter((variant: any) => variant.is_active !== false)
    .map(mapCanonicalVariant)
    .sort((a: CatalogVariant, b: CatalogVariant) => a.sortOrder - b.sortOrder);
  const optionGroups = (Array.isArray(row.product_option_groups) ? row.product_option_groups : [])
    .filter((group: any) => group.is_active !== false)
    .map(mapCanonicalOptionGroup)
    .sort((a: CatalogOptionGroup, b: CatalogOptionGroup) => a.sortOrder - b.sortOrder);

  const base = { ...row };
  delete base.product_variants;
  delete base.product_option_groups;
  return { ...base, variants, optionGroups } as Producto;
}

export async function getProductosActivos(businessUnitId?: string | null): Promise<Producto[]> {
  const supabase = createSupabaseServiceClient();
  const businessId = await resolveBusinessUnitId(businessUnitId);
  const { data, error } = await supabase
    .from('productos')
    .select('*, product_variants(*), product_option_groups(*, product_option_values(*))')
    .eq('business_unit_id', businessId)
    .eq('activo', true)
    .order('destacado', { ascending: false });

  if (error) {
    console.error('Error cargando productos:', error);
    return [];
  }
  return (data || [])
    .filter((p: any) => !/prueba/i.test(p.slug || '') && !/prueba/i.test(p.nombre || ''))
    .map(mapStorefrontProduct);
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
    .select('*, product_variants(*), product_option_groups(*, product_option_values(*))')
    .eq('id', id)
    .eq('business_unit_id', businessId)
    .eq('activo', true)
    .maybeSingle();

  if (error || !data) return null;
  return mapStorefrontProduct(data);
}

export async function getProductoBySlug(slug: string, businessUnitId?: string | null): Promise<Producto | null> {
  const supabase = createSupabaseServiceClient();
  const businessId = await resolveBusinessUnitId(businessUnitId);
  const { data, error } = await supabase
    .from('productos')
    .select('*, product_variants(*), product_option_groups(*, product_option_values(*))')
    .eq('slug', slug)
    .eq('business_unit_id', businessId)
    .eq('activo', true)
    .maybeSingle();

  if (error || !data || /prueba/i.test(data.slug || '') || /prueba/i.test(data.nombre || '')) return null;
  return mapStorefrontProduct(data);
}
