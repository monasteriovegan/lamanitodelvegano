import assert from 'node:assert/strict';
import test from 'node:test';
import { sanitizeGeminiSchema } from '../src/lib/ai/providers/schema.ts';

test('Gemini recibe tools sin additionalProperties incompatible', () => {
  const schema = sanitizeGeminiSchema({
    type: 'object', additionalProperties: false,
    properties: { selections: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { quantity: { type: 'integer', minimum: 1 } } } } },
  });
  assert.equal('additionalProperties' in schema, false);
  assert.equal('additionalProperties' in ((schema.properties as any).selections.items), false);
  assert.equal(((schema.properties as any).selections.items.properties.quantity).minimum, 1);
});
