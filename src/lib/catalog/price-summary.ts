export interface PriceSummary {
  displayPrice: number;
  formattedDisplayPrice: string;
  originalPrice?: number | null;
  formattedOriginalPrice?: string | null;
  badge?: string | null;
  packSummary?: string | null;
  unitPriceLabel?: string | null;
}

type ProductPricingInput = {
  precio: number;
  precio_anterior?: number | null;
  precio_oferta?: number | null;
  gramaje?: string | null;
  variedades?: string | null;
  variants?: Array<{
    id?: string;
    name?: string;
    price: number;
    selectionQuantity?: number | null;
    isDefault?: boolean;
    active?: boolean;
  }>;
};

export function formatPriceCLP(amount: number): string {
  return `$${Math.round(amount).toLocaleString('es-CL')}`;
}

function isWeightVariantName(name?: string | null) {
  return /^\s*\d+(?:[.,]\d+)?\s*(?:g|kg)\b/i.test(String(name || ''));
}

/**
 * Genera un resumen de precios estructurado a partir del Catálogo Master.
 * Conserva el formato histórico de packs por cantidad y usa el nombre canónico
 * cuando las variantes representan pesos (ej. 120 g / 240 g).
 */
export function formatPriceSummary(product: ProductPricingInput): PriceSummary {
  const activeVariants = (product.variants || []).filter((v) => v.active !== false);

  if (activeVariants.length > 1) {
    const sorted = [...activeVariants].sort((a, b) => a.price - b.price);
    const firstVariant = sorted[0];
    const lastVariant = sorted[sorted.length - 1];
    const weightBased = isWeightVariantName(firstVariant.name) && isWeightVariantName(lastVariant.name);
    const firstLabel = weightBased
      ? String(firstVariant.name).trim()
      : `${firstVariant.selectionQuantity || 1} por`;
    const lastLabel = weightBased
      ? String(lastVariant.name).trim()
      : `${lastVariant.selectionQuantity || 1} por`;

    return {
      displayPrice: firstVariant.price,
      formattedDisplayPrice: formatPriceCLP(firstVariant.price),
      originalPrice: product.precio_anterior || null,
      formattedOriginalPrice: product.precio_anterior ? formatPriceCLP(product.precio_anterior) : null,
      packSummary: `${firstLabel} ${formatPriceCLP(firstVariant.price)} · ${lastLabel} ${formatPriceCLP(lastVariant.price)}`,
      unitPriceLabel: firstVariant.selectionQuantity === 1 ? `1 unidad ${formatPriceCLP(firstVariant.price)}` : undefined,
    };
  }

  const effectivePrice = product.precio_oferta && product.precio_oferta < product.precio
    ? product.precio_oferta
    : product.precio;

  const originalPrice = product.precio_anterior && product.precio_anterior > effectivePrice
    ? product.precio_anterior
    : (product.precio_oferta && product.precio > product.precio_oferta ? product.precio : null);

  return {
    displayPrice: effectivePrice,
    formattedDisplayPrice: formatPriceCLP(effectivePrice),
    originalPrice,
    formattedOriginalPrice: originalPrice ? formatPriceCLP(originalPrice) : null,
    badge: originalPrice ? 'Oferta' : null,
  };
}
