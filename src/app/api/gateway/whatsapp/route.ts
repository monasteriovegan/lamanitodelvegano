import { createHmac, timingSafeEqual } from 'node:crypto';

export const dynamic = 'force-dynamic';

type GatewayMessage = {
  eventId: string;
  messageId: string;
  remoteJid: string;
  phone: string;
  text: string;
  fromMe: boolean;
  timestamp: string;
  pushName?: string | null;
  source?: 'whatsapp-baileys';
};

function verifySignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.GATEWAY_SHARED_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const provided = signature.replace(/^sha256=/, '');
  if (expected.length !== provided.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!verifySignature(rawBody, request.headers.get('x-gateway-signature'))) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  let payload: GatewayMessage;
  try {
    payload = JSON.parse(rawBody) as GatewayMessage;
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (!payload.messageId || !payload.remoteJid || !payload.timestamp) {
    return Response.json({ error: 'invalid_payload' }, { status: 422 });
  }

  // Este endpoint queda como contrato estable del Gateway. La persistencia se
  // delega al backend/CRM configurado para no duplicar la lógica existente.
  const upstream = process.env.CRM_GATEWAY_UPSTREAM_URL;
  if (!upstream) {
    console.error('CRM_GATEWAY_UPSTREAM_URL is not configured');
    return Response.json({ error: 'crm_gateway_not_configured' }, { status: 503 });
  }

  const response = await fetch(upstream, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.CRM_GATEWAY_TOKEN ?? ''}`,
      'x-idempotency-key': payload.messageId,
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });

  const body = await response.text();
  return new Response(body || null, {
    status: response.status,
    headers: { 'content-type': response.headers.get('content-type') ?? 'application/json' },
  });
}
