import type { CatalogProduct, CatalogVariantOverride } from './types.ts';

type OverrideRow = {
  variant_id?: unknown;
  price_override?: unknown;
  compare_at_price_override?: unknown;
  is_active?: unknown;
};

function nullableInteger(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

export function mapSeasonVariantOverride(row: OverrideRow): CatalogVariantOverride {
  return {
    variantId: String(row.variant_id || ''),
    priceOverride: nullableInteger(row.price_override),
    compareAtPriceOverride: nullableInteger(row.compare_at_price_override),
    isActive: row.is_active !== false,
  };
}

export function applySeasonVariantOverrides(
  product: CatalogProduct,
  overrides: CatalogVariantOverride[],
): CatalogProduct {
  const byVariant = new Map(
    overrides.filter((override) => override.isActive).map((override) => [override.variantId, override]),
  );

  return {
    ...product,
    variants: product.variants.map((variant) => {
      const override = byVariant.get(variant.id);
      if (!override) return { ...variant };
      return {
        ...variant,
        price: override.priceOverride ?? variant.price,
        compareAtPrice: override.compareAtPriceOverride ?? variant.compareAtPrice ?? null,
      };
    }),
  };
}

export function seasonIsInWindow(
  startsAt: string | null | undefined,
  endsAt: string | null | undefined,
  now: Date = new Date(),
): boolean {
  const nowMs = now.getTime();
  if (startsAt) {
    const startMs = new Date(startsAt).getTime();
    if (Number.isFinite(startMs) && startMs > nowMs) return false;
  }
  if (endsAt) {
    const end = new Date(endsAt);
    if (/^\d{4}-\d{2}-\d{2}$/.test(endsAt)) end.setHours(23, 59, 59, 999);
    const endMs = end.getTime();
    if (Number.isFinite(endMs) && endMs < nowMs) return false;
  }
  return true;
}
