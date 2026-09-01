export type CatalogSelectionMode = 'single' | 'quantity';

export interface CatalogVariant {
  id: string;
  productId: string;
  sku: string;
  name: string;
  price: number;
  compareAtPrice?: number | null;
  weightGrams: number | null;
  unitsIncluded: number;
  selectionQuantity: number;
  managesStock: boolean;
  stock: number | null;
  active: boolean;
  sortOrder: number;
  imageUrl?: string | null;
}

export interface CatalogOptionValue {
  id: string;
  optionGroupId: string;
  code: string;
  label: string;
  priceDelta: number;
  active: boolean;
  sortOrder: number;
}

export interface CatalogOptionGroup {
  id: string;
  productId: string;
  code: string;
  name: string;
  selectionMode: CatalogSelectionMode;
  required: boolean;
  active: boolean;
  sortOrder: number;
  values: CatalogOptionValue[];
}

export interface CatalogPackComponent {
  id: string;
  componentProductId: string | null;
  componentName: string;
  quantity: number;
  unit: string;
  weightGrams: number | null;
  sortOrder: number;
}

export interface CatalogProduct {
  id: string;
  businessUnitId: string;
  slug: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  active: boolean;
  availabilityDates?: string[];
  emoji?: string | null;
  color?: string | null;
  variants: CatalogVariant[];
  optionGroups: CatalogOptionGroup[];
  packComponents: CatalogPackComponent[];
}

export type CatalogChannel = 'web' | 'whatsapp' | 'instagram' | 'remy';

export interface CatalogCampaignProduct extends CatalogProduct {
  featured: boolean;
  sortOrder: number;
}

export interface CatalogCampaign {
  id: string;
  tag: string;
  name: string;
  description: string | null;
  bannerImage: string | null;
  badgeText: string | null;
  startsAt: string | null;
  endsAt: string | null;
  products: CatalogCampaignProduct[];
}

export interface CatalogSelectionIntent {
  optionValueId: string;
  quantity: number;
}

export interface CatalogLineIntent {
  productId: string;
  variantId: string;
  quantity: number;
  selections?: CatalogSelectionIntent[];
  clientPrice?: number;
}

export interface ResolvedCatalogSelection {
  optionGroupId: string;
  optionGroupName: string;
  optionValueId: string;
  code: string;
  label: string;
  quantity: number;
}

export interface ResolvedCatalogLine {
  productId: string;
  productName: string;
  variantId: string;
  variantSku: string;
  variantName: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  selections: ResolvedCatalogSelection[];
}

export type CatalogLineError =
  | 'product_not_available'
  | 'variant_not_available'
  | 'invalid_quantity'
  | 'invalid_selection_quantity'
  | 'duplicate_option_value'
  | 'option_value_not_available'
  | 'required_option_missing'
  | 'single_option_quantity_invalid'
  | 'selection_quantity_mismatch';

export type CatalogLineResult =
  | { ok: true; line: ResolvedCatalogLine }
  | { ok: false; error: CatalogLineError };
