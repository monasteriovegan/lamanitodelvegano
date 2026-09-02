import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifyHmac(
  raw: string | Buffer,
  header: string | null,
  secret: string | undefined,
) {
  if (!header || !secret) return false;
  const supplied = header.replace(/^sha256=/, '');
  if (!/^[a-f0-9]{64}$/i.test(supplied)) return false;
  const expected = createHmac('sha256', secret).update(raw).digest('hex');
  return timingSafeEqual(Buffer.from(expected), Buffer.from(supplied));
}

export function verifyHmacAny(
  raw: string | Buffer,
  header: string | null,
  secrets: Array<string | undefined | null>,
) {
  const unique = [...new Set(secrets.map((secret) => String(secret || '').trim()).filter(Boolean))];
  return unique.some((secret) => verifyHmac(raw, header, secret));
}
