import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { generateAmountSearchVariants, normalizeAmountToNumber, textContainsAmount } from '../src/lib/messaging/amounts.ts';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

test('Amount Normalization: parses various Chilean peso formats into integer CLP', () => {
  assert.equal(normalizeAmountToNumber('$22.950'), 22950);
  assert.equal(normalizeAmountToNumber('22.950'), 22950);
  assert.equal(normalizeAmountToNumber('22 950'), 22950);
  assert.equal(normalizeAmountToNumber('22950'), 22950);
  assert.equal(normalizeAmountToNumber('$ 22.950 CLP'), 22950);
  assert.equal(normalizeAmountToNumber(22950), 22950);
  assert.equal(normalizeAmountToNumber('invalid'), null);
});

test('Amount Search Variants: generates all common representations for cross-channel search', () => {
  const variants = generateAmountSearchVariants('$22.950');
  assert.ok(variants.includes('22950'));
  assert.ok(variants.includes('22.950'));
  assert.ok(variants.includes('22 950'));
  assert.ok(variants.includes('$22.950'));
  assert.ok(variants.includes('$ 22.950'));
});

test('Amount Text Matching: detects amount in raw message bodies and OCR receipts', () => {
  assert.ok(textContainsAmount('Hola, ya te transferí $22.950 a tu cuenta BancoEstado', '$22.950'));
  assert.ok(textContainsAmount('Comprobante Banco de Chile Monto: 22.950 CLP', 22950));
  assert.ok(textContainsAmount('Total: 22 950 pesos', '22.950'));
  assert.ok(!textContainsAmount('Hola me gustaría pedir empanadas', '$22.950'));
});

test('Wonka Tools Registry: includes search_omnichannel_messages and get_conversation_messages as read-only tools', () => {
  const toolsCode = read('src/lib/wonka/tools.ts');
  assert.match(toolsCode, /name:\s*'search_omnichannel_messages'/);
  assert.match(toolsCode, /name:\s*'get_conversation_messages'/);
  assert.match(toolsCode, /toolName\s*===\s*'search_omnichannel_messages'/);
  assert.match(toolsCode, /toolName\s*===\s*'get_conversation_messages'/);
  assert.match(toolsCode, /matched_orders_with_same_amount/);
  assert.match(toolsCode, /ocr_text/);
});

test('Wonka System Prompt: enforces critical investigation rule and selects tools on payment queries', () => {
  const wonkaCode = read('src/lib/ai/wonka.ts');
  assert.match(wonkaCode, /REGLA CRÍTICA DE INVESTIGACIÓN/);
  assert.match(wonkaCode, /search_omnichannel_messages/);
  assert.match(wonkaCode, /NUNCA inventes clientes, pagos, montos ni mensajes/);
  assert.match(wonkaCode, /add\('search_omnichannel_messages'/);
});

test('OCR Media Storage and Backfill: includes permanent storage helper and backfill runner', () => {
  const ocrCode = read('src/lib/messaging/ocr.ts');
  assert.match(ocrCode, /persistMediaToStorage/);
  assert.match(ocrCode, /omnichannel-media/);
  assert.match(ocrCode, /runHistoricalMediaBackfill/);
  assert.match(ocrCode, /matchesFor22950/);
});
