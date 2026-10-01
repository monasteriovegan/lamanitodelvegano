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

/**
 * Genera un resumen de precios estructurado a partir del Catálogo Master.
 * Si existen variantes de pack o precios promocionales reales,
 * los destaca para aumentar la claridad y conversión comercial.
 */
export function formatPriceSummary(product: ProductPricingInput): PriceSummary {
  const activeVariants = (product.variants || []).filter((v) => v.active !== false);

  if (activeVariants.length > 1) {
    const sorted = [...activeVariants].sort((a, b) => a.price - b.price);
    const unitVariant = sorted[0];
    const packVariant = sorted[sorted.length - 1];

    const formatVariant = (variant: typeof unitVariant) => {
      const quantity = Number(variant.selectionQuantity || 0);
      return quantity > 0
        ? `${quantity} por ${formatPriceCLP(variant.price)}`
        : `${variant.name || 'Formato'} — ${formatPriceCLP(variant.price)}`;
    };
    const unitQty = Number(unitVariant.selectionQuantity || 0);
    const packSummary = `${formatVariant(unitVariant)} · ${formatVariant(packVariant)}`;

    return {
      displayPrice: unitVariant.price,
      formattedDisplayPrice: formatPriceCLP(unitVariant.price),
      originalPrice: product.precio_anterior || null,
      formattedOriginalPrice: product.precio_anterior ? formatPriceCLP(product.precio_anterior) : null,
      packSummary,
      unitPriceLabel: unitQty === 1 ? `1 unidad ${formatPriceCLP(unitVariant.price)}` : undefined,
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
