import crypto from 'node:crypto';

type MercadoPagoWebhookSignatureInput = {
  signature: string | null;
  requestId: string | null;
  dataId: string;
  secret: string;
};

function signatureParts(signature: string) {
  const parts = signature.split(',').map((part) => part.trim());
  return {
    ts: parts.find((part) => part.startsWith('ts='))?.slice(3) || '',
    v1: parts.find((part) => part.startsWith('v1='))?.slice(3) || '',
  };
}

export function validateMercadoPagoWebhookSignature(input: MercadoPagoWebhookSignatureInput) {
  if (!input.secret || !input.signature) return false;
  const { ts, v1 } = signatureParts(input.signature);
  if (!ts || !v1) return false;
  const manifest = [
    input.dataId ? `id:${input.dataId};` : '',
    input.requestId ? `request-id:${input.requestId};` : '',
    `ts:${ts};`,
  ].join('');
  const expected = crypto.createHmac('sha256', input.secret).update(manifest).digest('hex');
  if (expected.length !== v1.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
}
