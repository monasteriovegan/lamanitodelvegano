export type ConversationBundleItem = {
  productId: string | null;
  productName: string;
  quantity: number;
  format: string | null;
  variety: string | null;
  customUnitPrice: number | null;
  isCustom: boolean;
  bundleVariantId?: string;
  bundleUnitsIncluded?: number;
  bundleLineTotal?: number;
};

export type ConversationBundleVariant = {
  id: string;
  name: string;
  price: number;
  unitsIncluded: number;
  active: boolean;
  sortOrder: number;
};

export type ConversationBundleProduct = {
  id: string;
  name: string;
  basePrice: number;
  formatLabels: string[];
  variants: ConversationBundleVariant[];
};

function normalize(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('es-CL');
}

function combineVarieties(items: ConversationBundleItem[]) {
  if (items.length === 1) return items[0].variety || null;

  const quantities = new Map<string, { label: string; quantity: number }>();
  for (const item of items) {
    const label = String(item.variety || '').trim();
    if (!label) continue;
    const key = normalize(label);
    const existing = quantities.get(key);
    if (existing) existing.quantity += item.quantity;
    else quantities.set(key, { label, quantity: item.quantity });
  }

  if (!quantities.size) return null;
  return [...quantities.values()]
    .map((entry) => `${entry.quantity} ${entry.label}`)
    .join(', ');
}

/**
 * Conversation extraction often returns one line per flavor (for example five
 * lines of two empanadas). Pricing must not multiply the base unit price when
 * the combined quantity is exactly covered by an active catalog bundle.
 *
 * We only collapse implicit/unit-like lines. Explicit formats are preserved.
 * The selected bundle must also exist in the legacy format labels consumed by
 * calcularPedido, so the authoritative checkout calculator remains the source
 * of the persisted price.
 */
export function collapseConversationBundleItems<T extends ConversationBundleItem>(
  items: T[],
  products: ConversationBundleProduct[],
): Array<T & ConversationBundleItem> {
  const productMap = new Map(products.map((product) => [product.id, product]));
  const grouped = new Map<string, T[]>();

  for (const item of items) {
    if (item.isCustom || !item.productId || item.format) continue;
    const bucket = grouped.get(item.productId) || [];
    bucket.push(item);
    grouped.set(item.productId, bucket);
  }

  const collapsed = new Map<string, ConversationBundleItem>();
  for (const [productId, group] of grouped) {
    const product = productMap.get(productId);
    if (!product) continue;
    const totalUnits = group.reduce((sum, item) => sum + item.quantity, 0);
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
    const first = group[0];
    collapsed.set(productId, {
      ...first,
      productName: product.name || first.productName,
      quantity: best.packs,
      format: best.variant.name,
      variety: combineVarieties(group),
      bundleVariantId: best.variant.id,
      bundleUnitsIncluded: best.variant.unitsIncluded,
      bundleLineTotal: best.lineTotal,
    });
  }

  const emitted = new Set<string>();
  const result: Array<T & ConversationBundleItem> = [];
  for (const item of items) {
    const productId = item.productId || '';
    const replacement = productId ? collapsed.get(productId) : undefined;
    if (!replacement) {
      result.push(item);
      continue;
    }
    if (emitted.has(productId)) continue;
    emitted.add(productId);
    result.push(replacement as T & ConversationBundleItem);
  }
  return result;
}
