import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { CatalogRepository } from './catalog-repository';
import { applySeasonVariantOverrides, mapSeasonVariantOverride, seasonIsInWindow } from './seasonal-catalog';
import type {
  CatalogCampaign,
  CatalogCampaignPurchaseTarget,
  CatalogChannel,
  CatalogPresentationSlot,
} from './types';
import { BusinessRepository } from '@/lib/repositories/business-repository';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

const CHANNEL_COLUMNS: Record<CatalogChannel, string> = {
  web: 'visible_web',
  whatsapp: 'visible_whatsapp',
  instagram: 'visible_instagram',
  remy: 'available_to_remy',
};

const PRESENTATION_SLOTS = new Set<CatalogPresentationSlot>(['hero_offer', 'featured', 'catalog', 'target_only']);

function presentationSlot(value: unknown): CatalogPresentationSlot {
  return PRESENTATION_SLOTS.has(value as CatalogPresentationSlot) ? value as CatalogPresentationSlot : 'catalog';
}

export async function loadCatalogCampaign(
  db: SupabaseClient,
  businessUnitId: string,
  campaignTag: string,
  channel: CatalogChannel = 'web',
  includeOutsideWindow = false,
): Promise<CatalogCampaign | null> {
  const channelColumn = CHANNEL_COLUMNS[channel];
  const { data: season, error: seasonError } = await db.from('seasons')
    .select('id,campaign_tag,name,description,banner_image,badge_text,starts_at,ends_at')
    .eq('business_unit_id', businessUnitId)
    .eq('campaign_tag', campaignTag)
    .eq('is_active', true)
    .eq(channelColumn, true)
    .maybeSingle();
  if (seasonError) throw seasonError;
  if (!season || (!includeOutsideWindow && !seasonIsInWindow(season.starts_at, season.ends_at))) return null;

  const { data: links, error: linksError } = await db.from('season_products')
    .select('product_id,is_featured,sort_order,campaign_name,campaign_description,campaign_image_url,campaign_alt_text,presentation_slot')
    .eq('season_id', season.id)
    .eq(channelColumn, true)
    .order('sort_order', { ascending: true });
  if (linksError) throw linksError;

  const { data: overrideRows, error: overrideError } = await db.from('season_variant_overrides')
    .select('variant_id,price_override,compare_at_price_override,is_active')
    .eq('business_unit_id', businessUnitId)
    .eq('season_id', season.id)
    .eq('is_active', true);
  if (overrideError) throw overrideError;
  const overrides = (overrideRows || []).map(mapSeasonVariantOverride);

  const { data: targetRows, error: targetError } = await db.from('season_product_variant_targets')
    .select('id,display_product_id,target_product_id,target_variant_id,group_label,option_label,sort_order')
    .eq('business_unit_id', businessUnitId)
    .eq('season_id', season.id)
    .order('sort_order', { ascending: true });
  if (targetError) throw targetError;

  const products = await new CatalogRepository(db).listActive(businessUnitId);
  const productById = new Map(products.map((product) => {
    const effective = applySeasonVariantOverrides(product, overrides);
    return [effective.id, effective] as const;
  }));
  const targetsByDisplayProduct = new Map<string, CatalogCampaignPurchaseTarget[]>();
  for (const row of targetRows || []) {
    const displayProductId = String(row.display_product_id || '');
    const targetProduct = productById.get(String(row.target_product_id || ''));
    const targetVariantId = String(row.target_variant_id || '');
    const targetVariant = targetProduct?.variants.find((variant) => variant.id === targetVariantId && variant.active);
    if (!productById.has(displayProductId) || !targetProduct || !targetVariant || targetVariant.productId !== targetProduct.id) continue;
    const targets = targetsByDisplayProduct.get(displayProductId) || [];
    targets.push({
      id: String(row.id),
      productId: targetProduct.id,
      productName: targetProduct.name,
      variantId: targetVariant.id,
      variantSku: targetVariant.sku,
      groupLabel: String(row.group_label || ''),
      optionLabel: String(row.option_label || ''),
      sortOrder: Number(row.sort_order || 0),
      price: targetVariant.price,
      compareAtPrice: targetVariant.compareAtPrice ?? null,
      managesStock: targetVariant.managesStock,
      stock: targetVariant.stock,
    });
    targetsByDisplayProduct.set(displayProductId, targets);
  }
  const campaignProducts = (links || []).flatMap((link) => {
    const master = productById.get(String(link.product_id));
    if (!master) return [];
    return [{
      ...master,
      featured: Boolean(link.is_featured),
      sortOrder: Number(link.sort_order || 0),
      campaignName: link.campaign_name || null,
      campaignDescription: link.campaign_description || null,
      campaignImageUrl: link.campaign_image_url || null,
      campaignAltText: link.campaign_alt_text || null,
      presentationSlot: presentationSlot(link.presentation_slot),
      purchaseTargets: targetsByDisplayProduct.get(master.id) || [],
    }];
  });

  return {
    id: String(season.id),
    tag: String(season.campaign_tag),
    name: String(season.name),
    description: season.description || null,
    bannerImage: season.banner_image || null,
    badgeText: season.badge_text || null,
    startsAt: season.starts_at || null,
    endsAt: season.ends_at || null,
    products: campaignProducts,
  };
}

export async function loadDefaultCatalogCampaign(
  campaignTag: string,
  channel: CatalogChannel = 'web',
  includeOutsideWindow = false,
) {
  const db = createSupabaseServiceClient();
  const business = await new BusinessRepository(db).requireDefault();
  return loadCatalogCampaign(db, business.id, campaignTag, channel, includeOutsideWindow);
}
