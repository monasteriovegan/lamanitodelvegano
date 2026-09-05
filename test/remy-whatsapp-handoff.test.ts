import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildWhatsAppHandoffUrl,
  createHandoffReference,
  extractHandoffReference,
} from '../src/lib/ai/remy-handoff-token.ts';

test('handoff reference is opaque and contains no web session or cart payload', () => {
  const reference = createHandoffReference();
  assert.match(reference, /^LMV-[A-Za-z0-9_-]{20,}$/);
  assert.doesNotMatch(reference, /web_|\{|\}|@|\+56/i);
});

test('WhatsApp handoff URL carries only a short continuation message', () => {
  const reference = 'LMV-AbCdEfGhIjKlMnOpQrStUvWx';
  const url = buildWhatsAppHandoffUrl('56990816124', reference);
  assert.match(url, /^https:\/\/wa\.me\/56990816124\?/);
  const decoded = decodeURIComponent(url);
  assert.match(decoded, /LMV-AbCdEfGhIjKlMnOpQrStUvWx/);
  assert.doesNotMatch(decoded, /carrito=|direccion=|email=|producto=/i);
});

test('handoff reference is extracted from a natural WhatsApp message and malformed values are ignored', () => {
  assert.equal(
    extractHandoffReference('Hola, quiero continuar mi compra. Código LMV-AbCdEfGhIjKlMnOpQrStUvWx'),
    'LMV-AbCdEfGhIjKlMnOpQrStUvWx',
  );
  assert.equal(extractHandoffReference('LMV-corto'), null);
  assert.equal(extractHandoffReference('hola sin código'), null);
});
