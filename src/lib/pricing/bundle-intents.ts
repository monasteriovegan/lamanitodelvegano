export type BundleIntent = {
  productoId: string;
  qty: number;
  variantId?: string;
  formato?: string | null;
  variedad?: string | null;
  [key: string]: unknown;
};

export type BundleVariant = {
  id: string;
  name: string;
  price: number;
  unitsIncluded: number;
  active: boolean;
  sortOrder: number;
};

export type BundleProduct = {
  id: string;
  name: string;
  basePrice: number;
  managesStock: boolean;
  formatLabels: string[];
  variants: BundleVariant[];
};

function normalize(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('es-CL');
}

function combineVarieties<T extends BundleIntent>(items: T[]) {
  if (items.length === 1) return items[0].variedad || null;
  const quantities = new Map<string, { label: string; quantity: number }>();
  for (const item of items) {
    const label = String(item.variedad || '').trim();
    if (!label) continue;
    const key = normalize(label);
    const existing = quantities.get(key);
    if (existing) existing.quantity += item.qty;
    else quantities.set(key, { label, quantity: item.qty });
  }
  if (!quantities.size) return null;
  return [...quantities.values()]
    .map((entry) => `${entry.quantity} ${entry.label}`)
    .join(', ');
}

/**
 * Applies an implicit catalog promotion only when all of the following are true:
 * - the caller did not already choose a variant/format;
 * - an active bundle variant exactly covers the requested unit count;
 * - the bundle name is also a valid legacy format consumed by calcularPedido;
 * - the bundle is cheaper than the same units at the base price;
 * - the legacy product is not stock-managed (stock-managed bundles require
 *   explicit variant-aware stock semantics and are intentionally left alone).
 *
 * This makes conversation extraction deterministic: five flavor lines of two
 * empanadas become one Pack 10 line instead of ten base-price units.
 */
export function collapseImplicitBundleIntents<T extends BundleIntent>(
  items: T[],
  products: BundleProduct[],
): T[] {
  const productMap = new Map(products.map((product) => [product.id, product]));
  const grouped = new Map<string, T[]>();

  for (const item of items) {
    if (!item.productoId || item.variantId || item.formato) continue;
    const bucket = grouped.get(item.productoId) || [];
    bucket.push(item);
    grouped.set(item.productoId, bucket);
  }

  const replacements = new Map<string, T>();
  for (const [productId, group] of grouped) {
    const product = productMap.get(productId);
    if (!product || product.managesStock) continue;
    const totalUnits = group.reduce((sum, item) => sum + Number(item.qty || 0), 0);
    if (!Number.isInteger(totalUnits) || totalUnits <= 1) continue;

    const baseTotal = Math.max(0, Number(product.basePrice || 0)) * totalUnits;
    const formats = new Set(product.formatLabels.map(normalize));
    const candidates = product.variants
      .filter((variant) => (
        variant.active
        && Number.isInteger(variant.unitsIncluded)
        && variant.unitsIncluded > 1
        && totalUnits % variant.unitsIncluded === 0
        && formats.has(normalize(variant.name))
      ))
      .map((variant) => ({
        variant,
        packs: totalUnits / variant.unitsIncluded,
        lineTotal: variant.price * (totalUnits / variant.unitsIncluded),
      }))
      .filter((candidate) => candidate.lineTotal > 0 && (baseTotal <= 0 || candidate.lineTotal < baseTotal))
      .sort((a, b) => a.lineTotal - b.lineTotal
        || b.variant.unitsIncluded - a.variant.unitsIncluded
        || a.variant.sortOrder - b.variant.sortOrder);

    const best = candidates[0];
    if (!best) continue;
    replacements.set(productId, {
      ...group[0],
      qty: best.packs,
      formato: best.variant.name,
      variedad: combineVarieties(group),
    });
  }

  const emitted = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    const replacement = replacements.get(item.productoId);
    if (!replacement) {
      result.push(item);
      continue;
    }
    if (emitted.has(item.productoId)) continue;
    emitted.add(item.productoId);
    result.push(replacement);
  }
  return result;
}
