import { createHmac } from 'node:crypto';

type PublicTrackingRow = {
  tracking_number?: unknown;
  estado?: unknown;
  fecha_entrega?: unknown;
  [key: string]: unknown;
};

const TRACKING_NUMBER_PATTERN = /^LMV-[A-F0-9]{10,64}$/;

export function parsePublicTrackingId(raw: string | null | undefined): string | null {
  const normalized = String(raw || '').trim().toUpperCase();
  return TRACKING_NUMBER_PATTERN.test(normalized) ? normalized : null;
}

export function toPublicTrackingResponse(row: PublicTrackingRow) {
  return {
    trackingNumber: String(row.tracking_number || ''),
    status: String(row.estado || 'Pendiente'),
    estimatedDelivery: row.fecha_entrega ? String(row.fecha_entrega) : null,
  };
}

export function fingerprintTrackingClient(
  client: { forwardedFor: string | null | undefined; userAgent: string | null | undefined },
  secret: string,
) {
  if (!secret) throw new Error('tracking_rate_limit_secret_missing');
  const firstForwardedAddress = String(client.forwardedFor || 'unknown').split(',')[0]?.trim() || 'unknown';
  return createHmac('sha256', secret).update(firstForwardedAddress).digest('hex');
}
