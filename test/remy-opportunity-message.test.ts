import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOpportunityMessage } from '../src/lib/opportunities/message.ts';

test('opportunity message uses only known safe facts', () => {
  const text = buildOpportunityMessage({ firstName: 'Ana', productName: 'Pack Parrillero', stage: 'product_interest' });
  assert.match(text, /Ana/);
  assert.match(text, /Pack Parrillero/);
  assert.doesNotMatch(text, /\$/);
  assert.doesNotMatch(text, /descuento|stock|entrega garantizada/i);
});

test('payment pending message avoids inventing payment state details', () => {
  const text = buildOpportunityMessage({ firstName: 'Luis', productName: 'Box', stage: 'payment_pending' });
  assert.match(text, /pedido/i);
  assert.doesNotMatch(text, /aprobado|rechazado|vencido/i);
});
