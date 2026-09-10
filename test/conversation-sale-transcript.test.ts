import test from 'node:test';
import assert from 'node:assert/strict';
import { buildConversationSaleTranscript } from '../src/lib/orders/conversation-sale-transcript.ts';

test('la extracción de pedido puede leer el OCR comercial de una captura del carrito', () => {
  const transcript = buildConversationSaleTranscript([{
    direction: 'inbound',
    body: null,
    message_type: 'image',
    payload: {
      ocr_text: 'Pack Parrillero Vegano 2 $15.000 | Pack 10 empanadas $23.900 | Total $52.700',
      ocr_is_receipt: false,
    },
  }]);

  assert.match(transcript, /Pack Parrillero Vegano 2/);
  assert.match(transcript, /Pack 10 empanadas/);
  assert.match(transcript, /52\.700/);
});

test('un comprobante aporta hechos estructurados sin enviar su OCR bancario completo al extractor', () => {
  const transcript = buildConversationSaleTranscript([{
    direction: 'inbound',
    body: null,
    message_type: 'image',
    payload: {
      ocr_text: 'Transferencia aprobada RUT 12.345.678-9 cuenta 123456789 por $52.700',
      ocr_is_receipt: true,
      ocr_detected_amounts: [52700],
      ocr_bank: 'Mercado Pago',
      ocr_sender: 'Camila Aravena',
    },
  }]);

  assert.match(transcript, /COMPROBANTE/);
  assert.match(transcript, /52700/);
  assert.match(transcript, /Mercado Pago/);
  assert.match(transcript, /Camila Aravena/);
  assert.doesNotMatch(transcript, /12\.345\.678-9/);
  assert.doesNotMatch(transcript, /123456789/);
});
