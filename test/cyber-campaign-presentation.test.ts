import assert from 'node:assert/strict';
import test from 'node:test';
import { toPublicCatalogCampaign } from '../src/lib/catalog/public-dto.ts';
import type { CatalogCampaign } from '../src/lib/catalog/types.ts';

function campaignFixture(): CatalogCampaign {
  const targetVariants = Array.from({ length: 6 }, (_, index) => ({
    id: `variant-${index + 1}`,
    productId: `target-${Math.floor(index / 2) + 1}`,
    sku: `SKU-${index + 1}`,
    name: index % 2 ? '240 g' : '120 g',
    price: index % 2 ? 17900 : 10900,
    compareAtPrice: index % 2 ? 22900 : null,
    weightGrams: index % 2 ? 240 : 120,
    unitsIncluded: 1,
    selectionQuantity: 0,
    managesStock: false,
    stock: null,
    active: true,
    sortOrder: index * 10,
  }));
  const targetProducts = Array.from({ length: 3 }, (_, index) => ({
    id: `target-${index + 1}`,
    businessUnitId: 'bu-1',
    slug: `target-${index + 1}`,
    name: `Universo ${index + 1}`,
    description: null,
    imageUrl: `/products/target-${index + 1}.jpg`,
    active: true,
    variants: targetVariants.filter((variant) => variant.productId === `target-${index + 1}`),
    optionGroups: [],
    packComponents: [],
    featured: false,
    sortOrder: 70 + index * 10,
    campaignName: null,
    campaignDescription: null,
    campaignImageUrl: null,
    campaignAltText: null,
    presentationSlot: 'target_only',
    purchaseTargets: [],
  }));

  return {
    id: 'season-1',
    tag: 'cyber-day-chocolatoso-2026',
    name: 'Cyber Day Chocolatoso',
    description: null,
    bannerImage: '/campaigns/cyber-day-chocolatoso-2026/hero-duo-barras.webp',
    badgeText: 'CYBER',
    startsAt: null,
    endsAt: null,
    products: [{
      id: 'display-1',
      businessUnitId: 'bu-1',
      slug: 'barra-terremoto',
      name: 'Barra Terremoto',
      description: null,
      imageUrl: '/products/barra-terremoto.jpg',
      active: true,
      variants: [],
      optionGroups: [],
      packComponents: [],
      featured: true,
      sortOrder: 50,
      campaignName: 'Elige tu universo Cyber',
      campaignDescription: 'Dubái, Terremoto o Explosión de Supernova.',
      campaignImageUrl: '/campaigns/cyber-day-chocolatoso-2026/barras-configurables.webp',
      campaignAltText: 'Barras Cyber configurables',
      presentationSlot: 'featured',
      purchaseTargets: [
        ...targetVariants.map((variant, index) => ({
          id: `target-link-${index + 1}`,
          productId: variant.productId,
          productName: `Universo ${Math.floor(index / 2) + 1}`,
          variantId: variant.id,
          variantSku: variant.sku,
          groupLabel: `Universo ${Math.floor(index / 2) + 1}`,
          optionLabel: variant.name,
          sortOrder: index * 10,
          price: variant.price,
          compareAtPrice: variant.compareAtPrice,
          managesStock: false,
          stock: null,
        })),
        {
          id: 'foreign-link', productId: 'foreign-product', productName: 'Ajeno',
          variantId: 'foreign-variant', variantSku: 'FOREIGN', groupLabel: 'Ajeno',
          optionLabel: 'Ajeno', sortOrder: 999, price: 1, compareAtPrice: null,
          managesStock: false, stock: null,
        },
      ],
    }, ...targetProducts],
  } as CatalogCampaign;
}

test('public campaign DTO keeps master and campaign media separate', () => {
  const dto = toPublicCatalogCampaign(campaignFixture());
  assert.equal(dto.products[0].imageUrl, '/products/barra-terremoto.jpg');
  assert.equal(dto.products[0].campaignImageUrl, '/campaigns/cyber-day-chocolatoso-2026/barras-configurables.webp');
  assert.equal(dto.products[0].presentationSlot, 'featured');
  assert.equal(dto.products[0].purchaseTargets.length, 6);
  assert.ok(dto.products[0].purchaseTargets.every((target) => target.productId && target.variantId));
});

test('invalid or foreign purchase targets are omitted', () => {
  const dto = toPublicCatalogCampaign(campaignFixture());
  assert.equal(dto.products[0].purchaseTargets.some((target) => target.variantId === 'foreign-variant'), false);
  assert.equal('businessUnitId' in dto.products[0].purchaseTargets[0], false);
});
