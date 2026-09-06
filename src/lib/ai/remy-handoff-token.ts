import { randomBytes } from 'node:crypto';

const HANDOFF_PATTERN = /\bLMV-[A-Za-z0-9_-]{20,64}\b/;

export function createHandoffReference() {
  return `LMV-${randomBytes(18).toString('base64url')}`;
}

export function extractHandoffReference(text: string) {
  return String(text || '').match(HANDOFF_PATTERN)?.[0] || null;
}

export function buildWhatsAppHandoffUrl(phone: string, reference: string) {
  const normalizedPhone = String(phone || '').replace(/\D/g, '');
  if (!normalizedPhone) throw new Error('whatsapp_phone_missing');
  if (!HANDOFF_PATTERN.test(String(reference || ''))) throw new Error('invalid_handoff_reference');
  const message = `Hola, quiero continuar mi compra de la web. Código ${reference}`;
  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
}
