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

test('provider fuerza y valida un tool que el prompt declara obligatorio', () => {
  const provider = read('src/lib/ai/providers/index.ts');
  assert.match(provider, /requiredToolName\?: string/);
  assert.match(provider, /resolveRequiredToolName/);
  assert.match(provider, /Debes\\s\+llamar\\s\+a/);
  assert.match(provider, /allowedFunctionNames:\s*\[requiredToolName\]/);
  assert.match(provider, /tool_choice\s*=\s*\{\s*type:\s*'function'/s);
  assert.match(provider, /required_tool_missing/);
});

test('prompts de ventas declaran explícitamente su única función obligatoria', () => {
  const sale = read('src/lib/orders/conversation-sale.ts');
  const offcatalog = read('src/lib/orders/confirmed-offcatalog-review.ts');
  assert.match(sale, /Debes llamar a extract_sale una sola vez/);
  assert.match(offcatalog, /Debes llamar a extract_missing_offcatalog_items una sola vez/);
});