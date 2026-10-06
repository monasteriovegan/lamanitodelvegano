import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildInitialOptionState,
  evaluateOptionSelection,
  purchaseActionState,
} from '../src/lib/catalog/purchase-option-state.ts';

const preparationGroups = [{
  id: 'preparation',
  name: 'Preparación / sabor',
  selectionMode: 'single' as const,
  required: true,
  values: [
    { id: 'mongolian', code: 'mongolian', label: 'Seitán mongoliano', priceDelta: 0 },
    { id: 'herbs', code: 'herbs', label: 'Seitán al pil pil y finas hierbas', priceDelta: 0 },
  ],
}];

const flavorGroups = [{
  id: 'flavors',
  name: 'Toppings / Sabores',
  selectionMode: 'quantity' as const,
  required: true,
  values: [
    { id: 'chocolate', code: 'chocolate', label: 'Chocolate', priceDelta: 0 },
    { id: 'berries', code: 'berries', label: 'Frutos rojos', priceDelta: 0 },
  ],
}];

test('a required single preparation starts visibly selected so Seitán can be added immediately', () => {
  const initial = buildInitialOptionState(preparationGroups);
  assert.deepEqual(initial, { preparation: { mongolian: 1 } });

  const progress = evaluateOptionSelection(preparationGroups, initial, 0, 1);
  assert.equal(progress.valid, true);
  assert.deepEqual(progress.selections.map((selection) => [selection.label, selection.quantity]), [
    ['Seitán mongoliano', 1],
  ]);
  assert.deepEqual(purchaseActionState(1, progress), {
    disabled: false,
    needsSelection: false,
    label: '🛒 Agregar al carrito',
  });
});

test('an incomplete flavor distribution stays clickable and explains exactly what remains', () => {
  const progress = evaluateOptionSelection(flavorGroups, {}, 6, 1);
  assert.equal(progress.valid, false);
  assert.deepEqual(progress.messages, ['Elige 6 unidades en Toppings / Sabores.']);
  assert.deepEqual(purchaseActionState(1, progress), {
    disabled: false,
    needsSelection: true,
    label: '↑ Completa tus opciones para agregar',
  });
});

test('the flavor guidance reports only the remaining units and becomes addable at the exact target', () => {
  const partial = evaluateOptionSelection(flavorGroups, { flavors: { chocolate: 4 } }, 6, 1);
  assert.deepEqual(partial.messages, ['Te faltan 2 unidades en Toppings / Sabores.']);

  const complete = evaluateOptionSelection(flavorGroups, { flavors: { chocolate: 4, berries: 2 } }, 6, 1);
  assert.equal(complete.valid, true);
  assert.equal(purchaseActionState(1, complete).disabled, false);
});
