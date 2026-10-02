import type { CatalogCartSelection } from './catalog-cart.ts';

export type PurchaseOptionGroup = {
  id: string;
  name: string;
  selectionMode: 'single' | 'quantity';
  required: boolean;
  values: Array<{
    id: string;
    code: string;
    label: string;
    priceDelta: number;
  }>;
};

export type PurchaseOptionState = Record<string, Record<string, number>>;

export type PurchaseOptionProgress = {
  valid: boolean;
  selections: CatalogCartSelection[];
  messages: string[];
};

export function buildInitialOptionState(groups: PurchaseOptionGroup[]): PurchaseOptionState {
  return Object.fromEntries(
    groups
      .filter((group) => group.required && group.selectionMode === 'single' && group.values.length > 0)
      .map((group) => [group.id, { [group.values[0].id]: 1 }]),
  );
}

export function evaluateOptionSelection(
  groups: PurchaseOptionGroup[],
  state: PurchaseOptionState,
  selectionQuantity: number,
  quantity: number,
): PurchaseOptionProgress {
  let valid = true;
  const selections: CatalogCartSelection[] = [];
  const messages: string[] = [];

  for (const group of groups) {
    const values = state[group.id] || {};
    const total = Object.values(values).reduce((sum, selectedQuantity) => sum + selectedQuantity, 0);
    const target = group.selectionMode === 'quantity'
      ? Math.max(0, selectionQuantity * quantity)
      : 1;

    if (group.required && total !== target) {
      valid = false;
      if (group.selectionMode === 'single') {
        messages.push(`Elige una opción en ${group.name}.`);
      } else if (total === 0) {
        messages.push(`Elige ${target} ${target === 1 ? 'unidad' : 'unidades'} en ${group.name}.`);
      } else if (total < target) {
        const remaining = target - total;
        messages.push(`Te ${remaining === 1 ? 'falta' : 'faltan'} ${remaining} ${remaining === 1 ? 'unidad' : 'unidades'} en ${group.name}.`);
      } else {
        const excess = total - target;
        messages.push(`Quita ${excess} ${excess === 1 ? 'unidad' : 'unidades'} en ${group.name}.`);
      }
    }

    for (const value of group.values) {
      const selectedQuantity = values[value.id] || 0;
      if (selectedQuantity > 0) {
        selections.push({
          optionGroupId: group.id,
          optionGroupName: group.name,
          optionValueId: value.id,
          code: value.code,
          label: value.label,
          quantity: selectedQuantity,
        });
      }
    }
  }

  return { valid, selections, messages };
}

export function purchaseActionState(quantity: number, progress: PurchaseOptionProgress) {
  if (quantity <= 0) {
    return { disabled: true, needsSelection: false, label: '🛒 Agregar al carrito' };
  }
  if (!progress.valid) {
    return { disabled: false, needsSelection: true, label: '↑ Completa tus opciones para agregar' };
  }
  return { disabled: false, needsSelection: false, label: '🛒 Agregar al carrito' };
}
