export const dynamic = 'force-static';

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

export default async function ProbePage() {
  const results = [] as Array<{path:string,status:number,body:string}>;
  for (const path of PATHS) {
    const url = new URL(path, BASE);
    url.searchParams.set('connection_id', CONNECTION_ID);
    url.searchParams.set('waba_id', WABA_ID);
    try {
      const response = await fetch(url, { cache: 'no-store', redirect: 'manual' });
      results.push({ path, status: response.status, body: (await response.text()).slice(0, 1000) });
    } catch (error) {
      results.push({ path, status: 0, body: error instanceof Error ? error.message : 'fetch_failed' });
    }
  }
  console.log('META_SUBSCRIPTION_PROBE_RESULT=' + JSON.stringify(results));
  return <pre>{JSON.stringify(results, null, 2)}</pre>;
}
