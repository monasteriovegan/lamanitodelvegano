/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from '@supabase/supabase-js';
import { CatalogRepository } from './catalog-repository.ts';
import { toCatalogCartItem } from './catalog-cart.ts';
import { resolveCatalogLine } from './selection.ts';
import { applySeasonVariantOverrides, mapSeasonVariantOverride, seasonIsInWindow } from './seasonal-catalog.ts';
import type { CatalogChannel, CatalogLineIntent, CatalogProduct } from './types.ts';

const SITE_URL = 'https://lamanitodelvegano.cl';

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function usefulTerms(query: string) {
  const ignored = new Set(['que', 'tienen', 'para', 'incluye', 'quiero', 'una', 'uno', 'con', 'del', 'los', 'las']);
  return normalize(query).split(/[^a-z0-9]+/).filter((term) => term.length > 1 && !ignored.has(term));
}

export function matchesCatalogQuery(product: CatalogProduct, query: string, campaignTerms: string[] = []) {
  const terms = usefulTerms(query);
  if (!terms.length) return true;
  const normalizedQuery = normalize(query);
  const seasonalQuery = /\b18\b|fiestas?\s+patrias?/.test(normalizedQuery);
  if (seasonalQuery && campaignTerms.some((term) => /fiestas?\s+patrias?/.test(normalize(term)))) return true;
  const haystack = normalize([
    product.name,
    product.slug,
    product.description || '',
    ...product.variants.flatMap((variant) => [variant.name, variant.sku]),
    ...product.optionGroups.flatMap((group) => [group.name, ...group.values.map((value) => value.label)]),
    ...product.packComponents.flatMap((component) => [
      component.componentName,
      ...(component.optionGroups || []).flatMap((group) => [group.name, ...group.values.map((value) => value.label)]),
    ]),
    ...campaignTerms,
  ].join(' '));
  return terms.some((term) => haystack.includes(term));
}

export function toRemyCatalogProduct(product: CatalogProduct) {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    description: product.description,
    sku: product.sku || null,
    glutenFree: product.glutenFree === null || product.glutenFree === undefined ? null : Boolean(product.glutenFree),
    nutFree: product.nutFree === null || product.nutFree === undefined ? null : Boolean(product.nutFree),
    url: `${SITE_URL}/productos/${product.slug}`,
    imageUrl: product.imageUrl,
    deliveryDates: [...(product.availabilityDates || [])],
    variants: product.variants.filter((variant) => variant.active).map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      name: variant.name,
      price: variant.price,
      compareAtPrice: variant.compareAtPrice ?? null,
      weightGrams: variant.weightGrams,
      unitsIncluded: variant.unitsIncluded,
      selectionQuantity: variant.selectionQuantity,
      stock: variant.managesStock ? variant.stock : null,
    })),
    options: product.optionGroups.filter((group) => group.active).map((group) => ({
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
      })),
    })),
    components: product.packComponents.map((component) => ({
      name: component.componentName,
      quantity: component.quantity,
      unit: component.unit,
      weightGrams: component.weightGrams,
      options: (component.optionGroups || []).filter((group) => group.active).map((group) => ({
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
        })),
      })),
    })),
  };
}

export function buildRemyCartAddition(
  product: CatalogProduct,
  input: CatalogLineIntent & { campaignTag?: string },
) {
  const resolved = resolveCatalogLine(product, input);
  if (!resolved.ok) return resolved;
  return {
    ok: true as const,
    item: toCatalogCartItem(resolved.line, {
      emoji: product.emoji || undefined,
      campaignTag: input.campaignTag,
    }),
  };
}

export function catalogLookupInstruction(result: unknown) {
  return `CATÁLOGO MASTER VERIFICADO PARA ESTA CONSULTA:\n${JSON.stringify(result)}\nResponde usando exclusivamente estos datos comerciales. No inventes productos, contexto, precios, sabores ni disponibilidad. Si un pack incluye componentes con options requeridas, pregunta esa elección antes de cerrar el pedido. Si products está vacío, dilo con claridad.`;
}

const CHANNEL_COLUMN: Record<Exclude<CatalogChannel, 'remy'>, string> = {
  web: 'visible_web',
  whatsapp: 'visible_whatsapp',
  instagram: 'visible_instagram',
};

export async function searchCatalogMaster(
  db: SupabaseClient,
  businessUnitId: string,
  query: string,
  channel: Exclude<CatalogChannel, 'remy'>,
) {
  const products = await new CatalogRepository(db).listActive(businessUnitId);
  const productIds = products.map((product) => product.id);
  if (!productIds.length) return { products: [] };

  const { data: rawSeasons, error: seasonError } = await db.from('seasons')
    .select('id,name,campaign_tag,starts_at,ends_at,visible_web,visible_whatsapp,visible_instagram,available_to_remy')
    .eq('business_unit_id', businessUnitId)
    .eq('is_active', true);
  if (seasonError) throw seasonError;

  const seasons = (rawSeasons || [])
    .filter((season: any) => seasonIsInWindow(season.starts_at, season.ends_at))
    .sort((a: any, b: any) => new Date(b.starts_at || 0).getTime() - new Date(a.starts_at || 0).getTime());

  if (!seasons.length) {
    return {
      products: products.filter((product) => matchesCatalogQuery(product, query)).slice(0, 8).map(toRemyCatalogProduct),
    };
  }

  const seasonIds = seasons.map((season: any) => String(season.id));
  const seasonById = new Map(seasons.map((season: any) => [String(season.id), season]));
  const seasonRank = new Map(seasonIds.map((id, index) => [id, index]));
  const { data: links, error: linksError } = await db.from('season_products')
    .select('season_id,product_id,visible_web,visible_whatsapp,visible_instagram,available_to_remy')
    .in('season_id', seasonIds)
    .in('product_id', productIds);
  if (linksError) throw linksError;

  const { data: overrideRows, error: overrideError } = await db.from('season_variant_overrides')
    .select('season_id,variant_id,price_override,compare_at_price_override,is_active')
    .eq('business_unit_id', businessUnitId)
    .in('season_id', seasonIds)
    .eq('is_active', true);
  if (overrideError) throw overrideError;

  const overridesBySeason = new Map<string, ReturnType<typeof mapSeasonVariantOverride>[]>();
  for (const row of overrideRows || []) {
    const seasonId = String((row as any).season_id);
    overridesBySeason.set(seasonId, [...(overridesBySeason.get(seasonId) || []), mapSeasonVariantOverride(row as any)]);
  }

  const channelColumn = CHANNEL_COLUMN[channel];
  const linksByProduct = new Map<string, any[]>();
  for (const link of links || []) {
    const id = String(link.product_id);
    linksByProduct.set(id, [...(linksByProduct.get(id) || []), link]);
  }

  const campaignTermsByProduct = new Map<string, string[]>();
  for (const link of links || []) {
    const season: any = seasonById.get(String(link.season_id));
    if (!season) continue;
    const id = String(link.product_id);
    campaignTermsByProduct.set(id, [...(campaignTermsByProduct.get(id) || []), season.name, season.campaign_tag].filter(Boolean));
  }

  const effectiveProducts = products.flatMap((product) => {
    const productLinks = (linksByProduct.get(product.id) || []).sort(
      (a, b) => (seasonRank.get(String(a.season_id)) ?? 9999) - (seasonRank.get(String(b.season_id)) ?? 9999),
    );
    const link = productLinks.find((candidate) => {
      const season: any = seasonById.get(String(candidate.season_id));
      return season && season.available_to_remy && season[channelColumn] && candidate.available_to_remy && candidate[channelColumn];
    });
    if (!link) return [];
    const seasonId = String(link.season_id);
    return [applySeasonVariantOverrides(product, overridesBySeason.get(seasonId) || [])];
  });

  return {
    products: effectiveProducts
      .filter((product) => matchesCatalogQuery(product, query, campaignTermsByProduct.get(product.id)))
      .slice(0, 8)
      .map(toRemyCatalogProduct),
  };
}
