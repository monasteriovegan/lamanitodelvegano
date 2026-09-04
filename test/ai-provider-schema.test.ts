import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { sanitizeGeminiSchema } from '../src/lib/ai/providers/schema.ts';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

test('Gemini recibe tools sin additionalProperties incompatible', () => {
  const schema = sanitizeGeminiSchema({
    type: 'object', additionalProperties: false,
    properties: { selections: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { quantity: { type: 'integer', minimum: 1 } } } } },
  });
  assert.equal('additionalProperties' in schema, false);
  assert.equal('additionalProperties' in ((schema.properties as any).selections.items), false);
  assert.equal(((schema.properties as any).selections.items.properties.quantity).minimum, 1);
});

test('provider fuerza y valida el tool obligatorio antes de aceptar una extracción', () => {
  const provider = read('src/lib/ai/providers/index.ts');
  assert.match(provider, /requiredToolName\?: string/);
  assert.match(provider, /allowedFunctionNames:\s*\[input\.requiredToolName\]/);
  assert.match(provider, /tool_choice\s*=\s*\{\s*type:\s*'function'/s);
  assert.match(provider, /required_tool_missing/);
});

test('ventas conversacionales declaran sus tools de extracción como obligatorios', () => {
  const sale = read('src/lib/orders/conversation-sale.ts');
  const offcatalog = read('src/lib/orders/confirmed-offcatalog-review.ts');
  assert.match(sale, /requiredToolName:\s*'extract_sale'/);
  assert.match(offcatalog, /requiredToolName:\s*'extract_missing_offcatalog_items'/);
});