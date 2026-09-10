import type {
  CatalogLineIntent,
  CatalogLineResult,
  CatalogOptionGroup,
  CatalogProduct,
  CatalogVariant,
  ResolvedCatalogSelection,
} from './types.ts';

/**
 * Returns every option the customer must be able to choose for a sellable line.
 * Direct product options keep their canonical identity. Options belonging to a
 * linked pack component keep the child option/value IDs, but get a contextual
 * display name so production can see which component the choice belongs to.
 */
export function effectiveCatalogOptionGroups(product: CatalogProduct): CatalogOptionGroup[] {
  const groups: CatalogOptionGroup[] = product.optionGroups
    .filter((group) => group.active && group.productId === product.id)
    .map((group) => ({ ...group, values: group.values.map((value) => ({ ...value })) }));

  const seen = new Set(groups.map((group) => group.id));
  for (const component of product.packComponents || []) {
    for (const group of component.optionGroups || []) {
      if (!group.active || seen.has(group.id)) continue;
      seen.add(group.id);
      groups.push({
        ...group,
        name: `${component.componentName} — ${group.name}`,
        values: group.values.map((value) => ({ ...value })),
      });
    }
  }

  return groups.sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Quantity-mode options describe physical units inside each purchased variant. */
export function requiredSelectionQuantity(
  group: CatalogOptionGroup,
  variant: Pick<CatalogVariant, 'selectionQuantity'>,
  lineQuantity: number,
) {
  return group.selectionMode === 'quantity' ? variant.selectionQuantity * lineQuantity : 1;
}

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

  const groups = effectiveCatalogOptionGroups(product);
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

  for (const group of groups) {
    const selectedForGroup = resolved.filter((item) => item.optionGroupId === group.id);
    const selectedQuantity = selectedForGroup.reduce((sum, item) => sum + item.quantity, 0);
    const expectedQuantity = requiredSelectionQuantity(group, variant, input.quantity);

    if (group.required && selectedForGroup.length === 0) {
      return { ok: false, error: 'required_option_missing' };
    }
    if (group.selectionMode === 'single' && selectedForGroup.length > 1) {
      return { ok: false, error: 'single_option_quantity_invalid' };
    }
    if (group.required && selectedQuantity !== expectedQuantity) {
      return {
        ok: false,
        error: group.selectionMode === 'single'
          ? 'single_option_quantity_invalid'
          : 'selection_quantity_mismatch',
      };
    }
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