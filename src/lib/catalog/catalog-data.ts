import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { CatalogRepository } from './catalog-repository';
import type { CatalogCampaign, CatalogChannel } from './types';
import { BusinessRepository } from '@/lib/repositories/business-repository';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

const CHANNEL_COLUMNS: Record<CatalogChannel, string> = {
  web: 'visible_web',
  whatsapp: 'visible_whatsapp',
  instagram: 'visible_instagram',
  remy: 'available_to_remy',
};

export async function loadCatalogCampaign(
  db: SupabaseClient,
  businessUnitId: string,
  campaignTag: string,
  channel: CatalogChannel = 'web',
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
  if (!season) return null;

  const { data: links, error: linksError } = await db.from('season_products')
    .select('product_id,is_featured,sort_order')
    .eq('season_id', season.id)
    .eq(channelColumn, true)
    .order('sort_order', { ascending: true });
  if (linksError) throw linksError;

  const products = await new CatalogRepository(db).listActive(businessUnitId);
  const productById = new Map(products.map((product) => [product.id, product]));
  const campaignProducts = (links || []).flatMap((link) => {
    const product = productById.get(String(link.product_id));
    return product ? [{ ...product, featured: Boolean(link.is_featured), sortOrder: Number(link.sort_order || 0) }] : [];
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

export async function loadDefaultCatalogCampaign(campaignTag: string, channel: CatalogChannel = 'web') {
  const db = createSupabaseServiceClient();
  const business = await new BusinessRepository(db).requireDefault();
  return loadCatalogCampaign(db, business.id, campaignTag, channel);
}
