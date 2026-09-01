import type { CatalogCampaign, CatalogProduct } from './types.ts';

export function toPublicCatalogProduct(product: CatalogProduct) {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    description: product.description,
    imageUrl: product.imageUrl,
    emoji: product.emoji || null,
    color: product.color || null,
    availabilityDates: [...(product.availabilityDates || [])],
    variants: product.variants.filter((variant) => variant.active).map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      name: variant.name,
      price: variant.price,
      compareAtPrice: variant.compareAtPrice ?? null,
      weightGrams: variant.weightGrams,
      unitsIncluded: variant.unitsIncluded,
      selectionQuantity: variant.selectionQuantity,
      managesStock: variant.managesStock,
      stock: variant.stock,
      imageUrl: variant.imageUrl || null,
    })),
    optionGroups: product.optionGroups.filter((group) => group.active).map((group) => ({
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
    packComponents: product.packComponents.map((component) => ({
      id: component.id,
      componentProductId: component.componentProductId,
      name: component.componentName,
      quantity: component.quantity,
      unit: component.unit,
      weightGrams: component.weightGrams,
    })),
  };
}

export function toPublicCatalogCampaign(campaign: CatalogCampaign) {
  return {
    id: campaign.id,
    campaignTag: campaign.tag,
    name: campaign.name,
    description: campaign.description,
    bannerImage: campaign.bannerImage,
    badgeText: campaign.badgeText,
    startsAt: campaign.startsAt,
    endsAt: campaign.endsAt,
    products: campaign.products.map((product) => ({
      ...toPublicCatalogProduct(product),
      featured: product.featured,
      sortOrder: product.sortOrder,
    })),
  };
}

export type PublicCatalogProduct = ReturnType<typeof toPublicCatalogProduct>;
export type PublicCatalogCampaign = ReturnType<typeof toPublicCatalogCampaign>;
