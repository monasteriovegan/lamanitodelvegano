/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from '@supabase/supabase-js';
import { CatalogRepository } from './catalog-repository.ts';
import { toCatalogCartItem } from './catalog-cart.ts';
import { resolveCatalogLine } from './selection.ts';
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
  const haystack = normalize([
    product.name,
    product.slug,
    product.description || '',
    ...product.variants.flatMap((variant) => [variant.name, variant.sku]),
    ...product.optionGroups.flatMap((group) => [group.name, ...group.values.map((value) => value.label)]),
    ...product.packComponents.map((component) => component.componentName),
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
    url: `${SITE_URL}/productos/${product.slug}`,
    imageUrl: product.imageUrl,
    deliveryDates: [...(product.availabilityDates || [])],
    variants: product.variants.filter((variant) => variant.active).map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      name: variant.name,
      price: variant.price,
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

  const { data: seasons, error: seasonError } = await db.from('seasons')
    .select('id,name,campaign_tag,visible_web,visible_whatsapp,visible_instagram,available_to_remy')
    .eq('business_unit_id', businessUnitId)
    .eq('is_active', true);
  if (seasonError) throw seasonError;

  const seasonById = new Map((seasons || []).map((season: any) => [String(season.id), season]));
  const { data: links, error: linksError } = await db.from('season_products')
    .select('season_id,product_id,visible_web,visible_whatsapp,visible_instagram,available_to_remy')
    .in('product_id', productIds);
  if (linksError) throw linksError;

  const channelColumn = CHANNEL_COLUMN[channel];
  const linksByProduct = new Map<string, any[]>();
  for (const link of links || []) {
    const id = String(link.product_id);
    linksByProduct.set(id, [...(linksByProduct.get(id) || []), link]);
  }

  const allowed = products.filter((product) => {
    const productLinks = linksByProduct.get(product.id) || [];
    if (!productLinks.length) return true;
    return productLinks.some((link) => {
      const season: any = seasonById.get(String(link.season_id));
      return season && season.available_to_remy && season[channelColumn] && link.available_to_remy && link[channelColumn];
    });
  });

  const campaignTermsByProduct = new Map<string, string[]>();
  for (const link of links || []) {
    const season: any = seasonById.get(String(link.season_id));
    if (!season) continue;
    campaignTermsByProduct.set(String(link.product_id), [season.name, season.campaign_tag].filter(Boolean));
  }

  return {
    products: allowed
      .filter((product) => matchesCatalogQuery(product, query, campaignTermsByProduct.get(product.id)))
      .slice(0, 8)
      .map(toRemyCatalogProduct),
  };
}
