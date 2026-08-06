import { createHmac } from 'node:crypto';

export function createGatewayActionToken(input: {
  orderId: string;
  action: 'confirm' | 'discard';
  ttlMinutes?: number;
}): string {
  const secret = process.env.GATEWAY_ACTION_SECRET;
  if (!secret) throw new Error('GATEWAY_ACTION_SECRET is not configured');
  const encoded = Buffer.from(JSON.stringify({
    orderId: input.orderId,
    action: input.action,
    expires: Date.now() + (input.ttlMinutes ?? 60 * 24) * 60_000,
  })).toString('base64url');
  const signature = createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}
