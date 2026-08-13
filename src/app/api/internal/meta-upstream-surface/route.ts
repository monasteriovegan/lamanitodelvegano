export const dynamic = 'force-dynamic';

const BASE = 'https://synthetiq-meta-dev-proxy.vercel.app';
const PATHS = ['/openapi.json','/api/openapi.json','/docs','/health','/webhooks/whatsapp'];

export async function GET() {
  const results = [] as Array<{path:string,status:number,content_type:string|null,body:string}>;
  for (const path of PATHS) {
    try {
      const response = await fetch(new URL(path, BASE), { cache: 'no-store', redirect: 'manual' });
      const text = await response.text();
      results.push({ path, status: response.status, content_type: response.headers.get('content-type'), body: text.slice(0, 12000) });
    } catch (error) {
      results.push({ path, status: 0, content_type: null, body: error instanceof Error ? error.message : 'fetch_failed' });
    }
  }
  return Response.json({ results });
}
