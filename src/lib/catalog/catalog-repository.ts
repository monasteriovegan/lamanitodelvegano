import type { SupabaseClient } from '@supabase/supabase-js';
import { parseFormatos, parseVariedades } from '../pricing/formatos.ts';
import type {
  CatalogOptionGroup,
  CatalogOptionValue,
  CatalogPackComponent,
  CatalogProduct,
  CatalogVariant,
} from './types.ts';

type DbRow = Record<string, any>;

const PRODUCT_RELATIONS = `
  *,
  product_variants(*),
  product_option_groups(*, product_option_values(*)),
  product_pack_components:product_pack_components!product_pack_components_pack_product_id_business_unit_id_fkey(*)
`;

function asInteger(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isInteger(number) ? number : fallback;
}

function parseAvailability(value: unknown) {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  if (typeof value !== 'string') return [];
  return value.split(',').map((item) => item.trim()).filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item));
}

function legacyVariants(row: DbRow): CatalogVariant[] {
  return parseFormatos(row.gramaje, Number(row.precio || 0)).map((format, index) => ({
    id: `legacy:${row.id}:${format.label || 'default'}`,
    productId: String(row.id),
    sku: String(row.sku || `LEGACY-${row.id}-${index + 1}`),
    name: format.label || 'Formato único',
    price: Number(format.precio || row.precio || 0),
    compareAtPrice: row.precio_anterior === null || row.precio_anterior === undefined ? null : Number(row.precio_anterior),
    weightGrams: row.weight_grams === null || row.weight_grams === undefined ? null : Number(row.weight_grams),
    unitsIncluded: 1,
    selectionQuantity: parseVariedades(row.variedades).length ? 1 : 0,
    managesStock: Boolean(row.maneja_stock),
    stock: row.stock === null || row.stock === undefined ? null : Number(row.stock),
    active: row.activo !== false,
    sortOrder: (index + 1) * 10,
    imageUrl: row.imagen_url || null,
  }));
}

function legacyOptionGroups(row: DbRow): CatalogOptionGroup[] {
  const varieties = parseVariedades(row.variedades);
  if (!varieties.length) return [];
  const groupId = `legacy:${row.id}:variety`;
  return [{
    id: groupId,
    productId: String(row.id),
    code: 'variedad',
    name: 'Variedad',
    selectionMode: 'quantity',
    required: true,
    active: true,
    sortOrder: 10,
    values: varieties.map((label, index) => ({
      id: `legacy:${row.id}:variety:${index + 1}`,
      optionGroupId: groupId,
      code: label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      label,
      priceDelta: 0,
      active: true,
      sortOrder: (index + 1) * 10,
    })),
  }];
}

function mapVariant(row: DbRow): CatalogVariant {
  return {
    id: String(row.id),
    productId: String(row.product_id),
    sku: String(row.sku),
    name: String(row.name),
    price: asInteger(row.price),
    compareAtPrice: row.compare_at_price === null || row.compare_at_price === undefined ? null : asInteger(row.compare_at_price),
    weightGrams: row.weight_grams === null || row.weight_grams === undefined ? null : asInteger(row.weight_grams),
    unitsIncluded: asInteger(row.units_included, 1),
    selectionQuantity: asInteger(row.selection_quantity),
    managesStock: Boolean(row.manages_stock),
    stock: row.stock === null || row.stock === undefined ? null : asInteger(row.stock),
    active: row.is_active !== false,
    sortOrder: asInteger(row.sort_order),
    imageUrl: row.image_url || null,
  };
}

function mapOptionValue(row: DbRow): CatalogOptionValue {
  return {
    id: String(row.id),
    optionGroupId: String(row.option_group_id),
    code: String(row.code),
    label: String(row.label),
    priceDelta: asInteger(row.price_delta),
    active: row.is_active !== false,
    sortOrder: asInteger(row.sort_order),
  };
}

function mapOptionGroup(row: DbRow, businessUnitId: string, productId: string): CatalogOptionGroup | null {
  if (row.business_unit_id !== businessUnitId || row.product_id !== productId || row.is_active === false) return null;
  const groupId = String(row.id);
  const values = (Array.isArray(row.product_option_values) ? row.product_option_values : [])
    .filter((value: DbRow) => value.business_unit_id === businessUnitId && value.option_group_id === groupId && value.is_active !== false)
    .map(mapOptionValue)
    .sort((a: CatalogOptionValue, b: CatalogOptionValue) => a.sortOrder - b.sortOrder);
  return {
    id: groupId,
    productId,
    code: String(row.code),
    name: String(row.name),
    selectionMode: row.selection_mode === 'single' ? 'single' : 'quantity',
    required: Boolean(row.is_required),
    active: true,
    sortOrder: asInteger(row.sort_order),
    values,
  };
}

function mapPackComponent(row: DbRow): CatalogPackComponent {
  return {
    id: String(row.id),
    componentProductId: row.component_product_id || null,
    componentName: String(row.component_name),
    quantity: Number(row.quantity),
    unit: String(row.unit),
    weightGrams: row.weight_grams === null || row.weight_grams === undefined ? null : asInteger(row.weight_grams),
    sortOrder: asInteger(row.sort_order),
  };
}

export function mapCatalogProductRow(businessUnitId: string, row: DbRow | null | undefined): CatalogProduct | null {
  if (!row || row.business_unit_id !== businessUnitId) return null;
  const productId = String(row.id);
  const normalizedVariants = (Array.isArray(row.product_variants) ? row.product_variants : [])
    .filter((variant: DbRow) => variant.business_unit_id === businessUnitId && variant.product_id === productId && variant.is_active !== false)
    .map(mapVariant)
    .sort((a: CatalogVariant, b: CatalogVariant) => a.sortOrder - b.sortOrder);
  const normalizedGroups = (Array.isArray(row.product_option_groups) ? row.product_option_groups : [])
    .map((group: DbRow) => mapOptionGroup(group, businessUnitId, productId))
    .filter((group: CatalogOptionGroup | null): group is CatalogOptionGroup => Boolean(group))
    .sort((a: CatalogOptionGroup, b: CatalogOptionGroup) => a.sortOrder - b.sortOrder);
  const packComponents = (Array.isArray(row.product_pack_components) ? row.product_pack_components : [])
    .filter((component: DbRow) => component.business_unit_id === businessUnitId && component.pack_product_id === productId)
    .map(mapPackComponent)
    .sort((a: CatalogPackComponent, b: CatalogPackComponent) => a.sortOrder - b.sortOrder);

  const isTest = /prueba/i.test(String(row.slug || '')) || /prueba/i.test(String(row.nombre || ''));
  if (isTest && row.activo === false) return null;

  return {
    id: productId,
    businessUnitId,
    slug: String(row.slug),
    name: String(row.nombre),
    description: row.descripcion || null,
    imageUrl: row.imagen_url || null,
    active: row.activo !== false,
    availabilityDates: parseAvailability(row.disponibilidad),
    emoji: row.emoji || null,
    color: row.color_fondo || null,
    sku: row.sku || null,
    glutenFree: Boolean(row.gluten_free),
    nutFree: Boolean(row.nut_free),
    ingredients: Array.isArray(row.ingredients) ? row.ingredients : (typeof row.ingredients === 'string' ? row.ingredients.split(',').map((s: string) => s.trim()) : []),
    allergens: Array.isArray(row.allergens) ? row.allergens : (typeof row.allergens === 'string' ? row.allergens.split(',').map((s: string) => s.trim()) : []),
    variants: normalizedVariants.length ? normalizedVariants : legacyVariants(row),
    optionGroups: normalizedGroups.length ? normalizedGroups : legacyOptionGroups(row),
    packComponents,
  };
}

export class CatalogRepository {
  private readonly db: SupabaseClient;

  constructor(db: SupabaseClient) {
    this.db = db;
  }

  async listActive(businessUnitId: string): Promise<CatalogProduct[]> {
    const { data, error } = await this.db.from('productos')
      .select(PRODUCT_RELATIONS)
      .eq('business_unit_id', businessUnitId)
      .eq('activo', true)
      .order('destacado', { ascending: false })
      .order('nombre', { ascending: true });
    if (error) throw error;
    return (data || []).map((row) => mapCatalogProductRow(businessUnitId, row)).filter((item): item is CatalogProduct => Boolean(item));
  }

  async getById(businessUnitId: string, productId: string, includeInactive = false): Promise<CatalogProduct | null> {
    let query = this.db.from('productos').select(PRODUCT_RELATIONS)
      .eq('business_unit_id', businessUnitId)
      .eq('id', productId);
    if (!includeInactive) query = query.eq('activo', true);
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return mapCatalogProductRow(businessUnitId, data);
  }

  async getBySlug(businessUnitId: string, slug: string, includeInactive = false): Promise<CatalogProduct | null> {
    let query = this.db.from('productos').select(PRODUCT_RELATIONS)
      .eq('business_unit_id', businessUnitId)
      .eq('slug', slug);
    if (!includeInactive) query = query.eq('activo', true);
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return mapCatalogProductRow(businessUnitId, data);
  }
}
