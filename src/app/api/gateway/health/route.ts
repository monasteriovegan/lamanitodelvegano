export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({
    ok: true,
    service: 'lamanitodelvegano-gateway-api',
    configured: {
      sharedSecret: Boolean(process.env.GATEWAY_SHARED_SECRET),
      actionSecret: Boolean(process.env.GATEWAY_ACTION_SECRET),
      crmGatewayUpstream: Boolean(process.env.CRM_GATEWAY_UPSTREAM_URL),
      crmOrderActionUpstream: Boolean(process.env.CRM_ORDER_ACTION_UPSTREAM_URL),
      crmToken: Boolean(process.env.CRM_GATEWAY_TOKEN),
    },
  }, { headers: { 'cache-control': 'no-store' } });
}
