import { toCatalogCartItem, type CatalogCartItem } from './catalog-cart.ts';
import { resolveCatalogLine } from './selection.ts';
import type { CatalogLineError, CatalogProduct, CatalogSelectionIntent } from './types.ts';

export interface CatalogCheckoutItemIntent {
  productoId: string;
  variantId?: string;
  qty: number;
  selections?: CatalogSelectionIntent[];
  campaignTag?: string;
  formato?: string | null;
  variedad?: string | null;
  clientPrice?: number;
  notas?: string | null;
}
export type CatalogCheckoutItemResult =
  | { ok: true; item: CatalogCartItem }
  | { ok: false; error: CatalogLineError };

export function resolveCatalogCheckoutItem(
  product: CatalogProduct,
  intent: CatalogCheckoutItemIntent,
): CatalogCheckoutItemResult {
  if (!intent.variantId) return { ok: false, error: 'variant_not_available' };
  const result = resolveCatalogLine(product, {
    productId: intent.productoId,
    variantId: intent.variantId,
    quantity: intent.qty,
    selections: intent.selections,
    clientPrice: intent.clientPrice,
  });
  if (!result.ok) return result;
  return {
    ok: true,
    item: toCatalogCartItem(result.line, {
      emoji: product.emoji || '🌱',
      campaignTag: intent.campaignTag,
      notas: intent.notas,
    }),
  };
}
