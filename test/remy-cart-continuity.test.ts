import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isCartMutationIntent,
  resolveCatalogLookupText,
} from '../src/lib/ai/remy-turn-context.ts';

test('quantity purchase language is a cart mutation intent', () => {
  assert.equal(isCartMutationIntent('quiero 6 empanadas napolitanas lista para consumo'), true);
  assert.equal(isCartMutationIntent('quiero 12 bombones de pistacho'), true);
  assert.equal(isCartMutationIntent('me llevo 4 alfajores'), true);
});

test('short confirmation keeps the latest product-bearing customer turn', () => {
  const history = [
    { direction: 'inbound' as const, body: 'quiero 6 empanadas napolitanas lista para consumo' },
    { direction: 'outbound' as const, body: '6 empanadas Napolitana a $2.900 cada una. ¿Confirmas el pedido?' },
    { direction: 'inbound' as const, body: 'si confirmo' },
  ];

  assert.equal(
    resolveCatalogLookupText('si confirmo', history),
    'quiero 6 empanadas napolitanas lista para consumo',
  );
});

test('normal product requests keep their own catalog lookup text', () => {
  assert.equal(
    resolveCatalogLookupText('quiero una barra dubai', []),
    'quiero una barra dubai',
  );
});
