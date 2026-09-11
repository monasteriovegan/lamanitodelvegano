import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { BusinessRepository } from '@/lib/repositories/business-repository';
import { CatalogRepository } from '@/lib/catalog/catalog-repository';
import { effectiveCatalogOptionGroups } from '@/lib/catalog/selection';
import { syncDulcesCatalog } from '@/lib/catalog/sync-dulces-catalog';
import type { CatalogProduct } from '@/lib/catalog/types';
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

const PRODUCT_PUBLIC_RELATIONS = `
  *,
  product_variants(*),
  product_option_groups(*, product_option_values(*))
`;

function publicOptionGroupsFromCatalog(product?: CatalogProduct | null) {
  if (!product) return undefined;
  const groups = effectiveCatalogOptionGroups(product).map((group) => ({
    id: group.id,
    code: group.code,
    name: group.name,
    selectionMode: group.selectionMode,
    required: group.required,
    values: group.values.filter((value) => value.active).map((value) => ({
      id: value.id,
      code: value.code,
      label: value.label,
      priceDelta: value.priceDelta,
      active: true,
    })),
  }));
  return groups.length ? groups : undefined;
}

function mapProductoRow(p: any, catalogProduct?: CatalogProduct | null): Producto {
  const variants = (p.product_variants || [])
    .filter((v: any) => v.is_active !== false)
    .sort((a: any, b: any) => Number(a.sort_order || 0) - Number(b.sort_order || 0))
    .map((v: any, index: number) => ({
      id: String(v.id),
      name: String(v.name),
      sku: v.sku ? String(v.sku) : null,
      price: Number(v.price || 0),
      compareAtPrice: v.compare_at_price !== null && v.compare_at_price !== undefined ? Number(v.compare_at_price) : null,
      compare_at_price: v.compare_at_price !== null && v.compare_at_price !== undefined ? Number(v.compare_at_price) : null,
      selectionQuantity: Number(v.selection_quantity || 0),
      unitsIncluded: Number(v.units_included || 1),
      isDefault: index === 0,
      active: true,
    }));

  const directOptionGroups = (p.product_option_groups || [])
    .filter((g: any) => g.is_active !== false)
    .sort((a: any, b: any) => Number(a.sort_order || 0) - Number(b.sort_order || 0))
    .map((g: any) => ({
      id: String(g.id),
      code: String(g.code),
      name: String(g.name),
      selectionMode: g.selection_mode === 'single' ? ('single' as const) : ('quantity' as const),
      required: Boolean(g.is_required),
      values: (g.product_option_values || [])
        .filter((val: any) => val.is_active !== false)
        .sort((a: any, b: any) => Number(a.sort_order || 0) - Number(b.sort_order || 0))
        .map((val: any) => ({
          id: String(val.id),
          code: String(val.code),
          label: String(val.label),
          priceDelta: Number(val.price_delta || 0),
          active: true,
        })),
    }));

  const canonicalOptionGroups = publicOptionGroupsFromCatalog(catalogProduct);

  return {
    ...p,
    variants: variants.length ? variants : undefined,
    optionGroups: canonicalOptionGroups || (directOptionGroups.length ? directOptionGroups : undefined),
  } as Producto;
}

export async function getProductosActivos(businessUnitId?: string | null): Promise<Producto[]> {
  const supabase = createSupabaseServiceClient();
  const businessId = await resolveBusinessUnitId(businessUnitId);
  let [{ data, error }, catalogProducts] = await Promise.all([
    supabase
      .from('productos')
      .select(PRODUCT_PUBLIC_RELATIONS)
      .eq('business_unit_id', businessId)
      .eq('activo', true)
      .order('destacado', { ascending: false }),
    new CatalogRepository(supabase).listActive(businessId),
  ]);

  // Self-healing check: if dulces catalog products are missing, sync and re-fetch
  const hasDulces = (data || []).some((p: any) => p.slug === 'protein-balls');
  if (!hasDulces) {
    try {
      await syncDulcesCatalog(supabase, businessId);
      const [refreshedData, refreshedCatalog] = await Promise.all([
        supabase
          .from('productos')
          .select(PRODUCT_PUBLIC_RELATIONS)
          .eq('business_unit_id', businessId)
          .eq('activo', true)
          .order('destacado', { ascending: false }),
        new CatalogRepository(supabase).listActive(businessId),
      ]);
      if (refreshedData.data) data = refreshedData.data;
      if (refreshedCatalog) catalogProducts = refreshedCatalog;
    } catch (err) {
      console.error('Error auto-syncing dulces catalog:', err);
    }
  }

  if (error) {
    console.error('Error cargando productos:', error);
    return [];
  }
  const catalogById = new Map((catalogProducts || []).map((product) => [product.id, product]));
  return (data || [])
    .filter((p: any) => !/prueba/i.test(p.slug || '') && !/prueba/i.test(p.nombre || ''))
    .map((p: any) => mapProductoRow(p, catalogById.get(String(p.id))));
}

export async function getCategorias(): Promise<Categoria[]> {
  const supabase = createSupabaseServiceClient();
  let { data, error } = await supabase.from('categorias').select('id, nombre, emoji, slug');
  if (error) {
    console.error('Error cargando categorías:', error);
    return [];
  }
  const hasDulces = (data || []).some((c: any) => c.slug === 'dulces-chocolateria' || c.id === 'dulces-chocolateria');
  if (!hasDulces) {
    try {
      await syncDulcesCatalog(supabase);
      const res = await supabase.from('categorias').select('id, nombre, emoji, slug');
      if (res.data) data = res.data;
    } catch (err) {
      console.error('Error auto-syncing categorias:', err);
    }
  }
  return (data || []) as Categoria[];
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
  const [{ data, error }, catalogProducts] = await Promise.all([
    supabase
      .from('productos')
      .select(PRODUCT_PUBLIC_RELATIONS)
      .eq('id', id)
      .eq('business_unit_id', businessId)
      .eq('activo', true)
      .maybeSingle(),
    new CatalogRepository(supabase).listActive(businessId),
  ]);

  if (error || !data) return null;
  return mapProductoRow(data, catalogProducts.find((product) => product.id === String(data.id)));
}

export async function getProductoBySlug(slug: string, businessUnitId?: string | null): Promise<Producto | null> {
  const supabase = createSupabaseServiceClient();
  const businessId = await resolveBusinessUnitId(businessUnitId);
  let [{ data, error }, catalogProducts] = await Promise.all([
    supabase
      .from('productos')
      .select(PRODUCT_PUBLIC_RELATIONS)
      .eq('slug', slug)
      .eq('business_unit_id', businessId)
      .eq('activo', true)
      .maybeSingle(),
    new CatalogRepository(supabase).listActive(businessId),
  ]);

  if (!data && ['protein-balls', 'brigadeiros-trufas-surtidos', 'box-rollitos-canela', 'barra-dubai', 'alfajores-canamo'].includes(slug)) {
    try {
      await syncDulcesCatalog(supabase, businessId);
      const [refreshedData, refreshedCatalog] = await Promise.all([
        supabase
          .from('productos')
          .select(PRODUCT_PUBLIC_RELATIONS)
          .eq('slug', slug)
          .eq('business_unit_id', businessId)
          .eq('activo', true)
          .maybeSingle(),
        new CatalogRepository(supabase).listActive(businessId),
      ]);
      if (refreshedData.data) data = refreshedData.data;
      if (refreshedCatalog) catalogProducts = refreshedCatalog;
    } catch (err) {
      console.error('Error auto-syncing dulces catalog for slug:', slug, err);
    }
  }

  if (error || !data || /prueba/i.test(data.slug || '') || /prueba/i.test(data.nombre || '')) return null;
  return mapProductoRow(data, catalogProducts.find((product) => product.id === String(data.id)));
}