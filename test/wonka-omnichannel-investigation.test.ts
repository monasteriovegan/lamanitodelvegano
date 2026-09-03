import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { generateAmountSearchVariants, normalizeAmountToNumber, textContainsAmount } from '../src/lib/messaging/amounts.ts';
import { formatDeterministicToolResponse } from '../src/lib/wonka/deterministic-synthesis.ts';

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

test('Deterministic Synthesis Fallback: handles 0 matches accurately without calling LLM', () => {
  const toolResults = [{
    name: 'search_omnichannel_messages',
    result: {
      total_matched_messages: 0,
      searched_amount: { input: '22950', normalized_clp: 22950, search_variants: ['22950', '22.950'] },
      matched_orders_with_same_amount: [],
      messages: [],
    },
  }];

  const response = formatDeterministicToolResponse(toolResults, 'Busca quién me hizo un pago de $22.950');
  assert.match(response, /no encontré coincidencias por \$22\.950/i);
});

test('Deterministic Synthesis Fallback: presents real evidence for positive matches without hallucinating', () => {
  const toolResults = [{
    name: 'search_omnichannel_messages',
    result: {
      total_matched_messages: 1,
      searched_amount: { input: '22950', normalized_clp: 22950 },
      matched_orders_with_same_amount: [{
        order_number: '1042',
        nombre_cliente: 'Ana Valenzuela',
        telefono: '+56987654321',
        total: 22950,
        estado: 'confirmed',
        source_channel: 'whatsapp',
        created_at: '2026-09-02T14:30:00Z',
      }],
      messages: [{
        channel: 'whatsapp',
        customer: { name: 'Ana Valenzuela', phone: '+56987654321' },
        sent_at: '2026-09-02T14:28:00Z',
        ocr_text: 'BancoEstado Transferencia exitosa Monto: $22.950 Destino: La Manito del Vegano',
      }],
    },
  }];

  const response = formatDeterministicToolResponse(toolResults, 'Busca quién me hizo un pago de $22.950');
  assert.match(response, /Ana Valenzuela/);
  assert.match(response, /Pedido #1042/);
  assert.match(response, /BancoEstado/);
});

test('Wonka Second Call: resends tool definitions to avoid Gemini/Groq function response 400 errors', () => {
  const wonkaCode = read('src/lib/ai/wonka.ts');
  assert.match(wonkaCode, /tools:\s*selectedTools/);
  assert.match(wonkaCode, /wonka_synthesis_llm_failed_using_deterministic_fallback/);
  assert.match(wonkaCode, /formatDeterministicToolResponse/);
});
