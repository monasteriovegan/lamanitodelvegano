export type CatalogAdminUpdate = {
  productId: string;
  variantId?: string;
  optionValueId?: string;
  price?: number;
  productActive?: boolean;
  variantActive?: boolean;
  optionActive?: boolean;
  stock?: number | null;
  visibleWeb?: boolean;
  visibleWhatsapp?: boolean;
  visibleInstagram?: boolean;
  availableToRemy?: boolean;
};

export function parseCatalogAdminUpdate(value: unknown): CatalogAdminUpdate {
  const body = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const productId = String(body.productId || '').trim();
  if (!productId) throw new Error('product_id_required');
  const result: CatalogAdminUpdate = { productId };
  const stringFields = ['variantId', 'optionValueId'] as const;
  for (const field of stringFields) if (body[field]) result[field] = String(body[field]);
  const booleanFields = ['productActive', 'variantActive', 'optionActive', 'visibleWeb', 'visibleWhatsapp', 'visibleInstagram', 'availableToRemy'] as const;
  for (const field of booleanFields) if (typeof body[field] === 'boolean') result[field] = body[field];
  if (body.price !== undefined) {
    const price = Number(body.price);
    if (!Number.isInteger(price) || price < 0) throw new Error('invalid_price');
    result.price = price;
  }
  if (body.stock === null) result.stock = null;
  else if (body.stock !== undefined) {
    const stock = Number(body.stock);
    if (!Number.isInteger(stock) || stock < 0) throw new Error('invalid_stock');
    result.stock = stock;
  }
  return result;
}
