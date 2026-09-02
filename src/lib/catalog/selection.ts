import type {
  CatalogLineIntent,
  CatalogLineResult,
  CatalogProduct,
  ResolvedCatalogSelection,
} from './types.ts';

export function resolveCatalogLine(product: CatalogProduct, input: CatalogLineIntent): CatalogLineResult {
  if (!product.active || input.productId !== product.id) {
    return { ok: false, error: 'product_not_available' };
  }

  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    return { ok: false, error: 'invalid_quantity' };
  }

  const variant = product.variants.find((item) => (
    item.id === input.variantId
    && item.productId === product.id
    && item.active
  ));
  if (!variant) return { ok: false, error: 'variant_not_available' };

  if (variant.managesStock && Number(variant.stock || 0) < input.quantity) {
    return { ok: false, error: 'variant_not_available' };
  }

  const groups = product.optionGroups.filter((group) => group.active && group.productId === product.id);
  const valueIndex = new Map(groups.flatMap((group) => (
    group.values
      .filter((value) => value.active && value.optionGroupId === group.id)
      .map((value) => [value.id, { group, value }] as const)
  )));
  const seenValues = new Set<string>();
  const resolved: ResolvedCatalogSelection[] = [];

  for (const selected of input.selections || []) {
    if (!Number.isInteger(selected.quantity) || selected.quantity <= 0) {
      return { ok: false, error: 'invalid_selection_quantity' };
    }
    if (seenValues.has(selected.optionValueId)) {
      return { ok: false, error: 'duplicate_option_value' };
    }
    seenValues.add(selected.optionValueId);

    const match = valueIndex.get(selected.optionValueId);
    if (!match) return { ok: false, error: 'option_value_not_available' };
    if (match.group.selectionMode === 'single' && selected.quantity !== 1) {
      return { ok: false, error: 'single_option_quantity_invalid' };
    }

    resolved.push({
      optionGroupId: match.group.id,
      optionGroupName: match.group.name,
      optionValueId: match.value.id,
      code: match.value.code,
      label: match.value.label,
      quantity: selected.quantity,
    });
  }

  for (const group of groups.filter((item) => item.required)) {
    const selectedForGroup = resolved.filter((item) => item.optionGroupId === group.id);
    if (selectedForGroup.length === 0) return { ok: false, error: 'required_option_missing' };
    if (group.selectionMode === 'single' && selectedForGroup.length !== 1) {
      return { ok: false, error: 'single_option_quantity_invalid' };
    }
  }

  const quantitySelectionTotal = resolved
    .filter((item) => groups.find((group) => group.id === item.optionGroupId)?.selectionMode === 'quantity')
    .reduce((sum, item) => sum + item.quantity, 0);
  if (quantitySelectionTotal !== variant.selectionQuantity) {
    return { ok: false, error: 'selection_quantity_mismatch' };
  }

  return {
    ok: true,
    line: {
      productId: product.id,
      productName: product.name,
      variantId: variant.id,
      variantSku: variant.sku,
      variantName: variant.name,
      unitPrice: variant.price,
      quantity: input.quantity,
      lineTotal: variant.price * input.quantity,
      selections: resolved,
    },
  };
}
