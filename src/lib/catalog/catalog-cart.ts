import type { ResolvedCatalogLine } from './types.ts';

export interface CatalogCartSelection {
  optionGroupId: string;
  optionGroupName: string;
  optionValueId: string;
  code: string;
  label: string;
  quantity: number;
}

export interface CatalogCartItem {
  productoId: string;
  nombre: string;
  precio: number;
  qty: number;
  emoji?: string;
  formato?: string | null;
  variedad?: string | null;
  variantId?: string;
  variantSku?: string;
  sku?: string;
  selections?: CatalogCartSelection[];
  campaignTag?: string;
  notas?: string | null;
}

export function toCatalogCartItem(
  line: ResolvedCatalogLine,
  options: { emoji?: string; campaignTag?: string; notas?: string | null } = {},
): CatalogCartItem {
  const selections = line.selections.map((selection) => ({ ...selection }));
  return {
    productoId: line.productId,
    nombre: line.productName,
    precio: line.unitPrice,
    qty: line.quantity,
    emoji: options.emoji || '🌱',
    formato: line.variantName,
    variedad: selections.length
      ? selections.map((selection) => `${selection.quantity}× ${selection.label}`).join(', ')
      : null,
    variantId: line.variantId,
    variantSku: line.variantSku,
    sku: line.variantSku,
    selections,
    campaignTag: options.campaignTag,
    notas: options.notas || null,
  };
}

type CatalogCartKeyInput = Pick<CatalogCartItem, 'productoId'> & Partial<Pick<
  CatalogCartItem,
  'variantId' | 'formato' | 'variedad' | 'selections'
>>;

export function catalogCartItemKey(item: CatalogCartKeyInput) {
  const selections = [...(item.selections || [])]
    .sort((a, b) => `${a.optionGroupId}:${a.optionValueId}`.localeCompare(`${b.optionGroupId}:${b.optionValueId}`))
    .map((selection) => `${selection.optionGroupId}:${selection.optionValueId}:${selection.quantity}`)
    .join('|');
  return [item.productoId, item.variantId || item.formato || '', selections || item.variedad || ''].join('::');
}
