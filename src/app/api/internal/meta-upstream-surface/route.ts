export const dynamic = 'force-dynamic';

const BASE = 'https://synthetiq-meta-dev-proxy.vercel.app';
const CONNECTION_ID = 'd51efda7-47a5-4ce4-9e91-23eaf2ad0dd7';
const WABA_ID = '1129249369256097';

const PATHS = [
  '/api/meta/assets/whatsapp-subscriptions',
  '/api/meta/assets/whatsapp-subscribed-apps',
  '/api/meta/assets/waba-subscriptions',
  '/api/meta/whatsapp/subscriptions',
  '/api/meta/webhooks/subscriptions',
  '/api/meta/subscriptions',
  '/api/meta/webhooks/whatsapp',
  '/webhooks/whatsapp',
];

export async function GET() {
  const results = [] as Array<{path:string,status:number,content_type:string|null,body:string}>;
  for (const path of PATHS) {
    try {
      const url = new URL(path, BASE);
      url.searchParams.set('connection_id', CONNECTION_ID);
      url.searchParams.set('waba_id', WABA_ID);
      const response = await fetch(url, { cache: 'no-store', redirect: 'manual' });
      const text = await response.text();
      results.push({ path, status: response.status, content_type: response.headers.get('content-type'), body: text.slice(0, 4000) });
    } catch (error) {
      results.push({ path, status: 0, content_type: null, body: error instanceof Error ? error.message : 'fetch_failed' });
    }
  }
  return Response.json({ results });
}
