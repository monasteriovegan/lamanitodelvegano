import { createHmac, timingSafeEqual } from 'node:crypto';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ token: string }> };

function decodeToken(token: string): { orderId: string; action: 'confirm' | 'discard'; expires: number } | null {
  try {
    const [encoded, signature] = token.split('.');
    if (!encoded || !signature) return null;
    const secret = process.env.GATEWAY_ACTION_SECRET;
    if (!secret) return null;
    const expected = createHmac('sha256', secret).update(encoded).digest('base64url');
    if (expected.length !== signature.length) return null;
    if (!timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return null;
    const data = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as {
      orderId: string;
      action: 'confirm' | 'discard';
      expires: number;
    };
    if (!data.orderId || !['confirm', 'discard'].includes(data.action) || Date.now() > data.expires) return null;
    return data;
  } catch {
    return null;
  }
}

export async function GET(_request: Request, context: RouteContext) {
  const { token } = await context.params;
  const action = decodeToken(token);
  if (!action) {
    return new Response('<h1>Enlace inválido o vencido</h1>', {
      status: 400,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }

  const upstream = process.env.CRM_ORDER_ACTION_UPSTREAM_URL;
  if (!upstream) {
    return new Response('<h1>La confirmación aún no está configurada</h1>', {
      status: 503,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }

  const response = await fetch(upstream, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.CRM_GATEWAY_TOKEN ?? ''}`,
      'x-idempotency-key': `${action.orderId}:${action.action}`,
    },
    body: JSON.stringify(action),
    cache: 'no-store',
  });

  const ok = response.ok;
  return new Response(
    `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><body style="font-family:system-ui;padding:32px;text-align:center"><h1>${ok ? '✅ Acción aplicada' : '⚠️ No se pudo aplicar'}</h1><p>Pedido ${action.orderId}: ${action.action === 'confirm' ? 'confirmado' : 'descartado'}.</p><p>Ya puedes cerrar esta ventana.</p></body></html>`,
    { status: ok ? 200 : 502, headers: { 'content-type': 'text/html; charset=utf-8' } },
  );
}
