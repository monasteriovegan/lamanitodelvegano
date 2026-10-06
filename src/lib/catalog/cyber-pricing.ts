import type { CatalogProduct, CatalogVariantOverride } from './types.ts';
import { seasonIsInWindow } from './seasonal-catalog.ts';
export const CYBER_TAG = 'cyber-day-chocolatoso-2026';
export const CYBER_DELIVERY_DATE = '2026-10-10';
export interface CyberCampaignPricing {
  startsAt: string | null;
  endsAt: string | null;
  overrides: CatalogVariantOverride[];
}
export function cyberIsActive(campaign: CyberCampaignPricing | null, now = new Date()): boolean {
  return Boolean(campaign && seasonIsInWindow(campaign.startsAt, campaign.endsAt, now));
}
/** Master prices stay intact. Explicit flyer prices win; all other formats get 25%. */
export function applyCyberPricing(product: CatalogProduct, campaign: CyberCampaignPricing | null, now = new Date()): CatalogProduct {
  if (!campaign || !cyberIsActive(campaign, now)) return product;
  const overrides = new Map(campaign.overrides.filter((o) => o.isActive && o.priceOverride !== null).map((o) => [o.variantId, o]));
  return {
    ...product,
    availabilityDates: [CYBER_DELIVERY_DATE],
    optionGroups: product.optionGroups.map((g) => ({ ...g, values: g.values.map((v) => ({
      ...v, priceDelta: product.variants.some((variant) => overrides.has(variant.id)) ? v.priceDelta : Math.round(v.priceDelta * 0.75),
    })) })),
    variants: product.variants.map((v) => {
      const override = overrides.get(v.id);
      return { ...v, price: override?.priceOverride ?? Math.round(v.price * 0.75), compareAtPrice: override?.compareAtPriceOverride ?? v.price };
    }),
  };
}
