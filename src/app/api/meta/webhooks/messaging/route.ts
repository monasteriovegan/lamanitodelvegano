import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { normalizeMetaInstagram } from '@/lib/messaging/normalize';
import { persistMessage } from '@/lib/messaging/messages';
import { verifyHmac } from '@/lib/messaging/signature';

export const dynamic = 'force-dynamic';

const UPSTREAM_PATH = '/webhooks/messaging';

function upstreamUrl(request: Request) {
  const configured = process.env.META_PROXY_UPSTREAM_URL;
  if (!configured) return null;
  try {
    const base = new URL(configured);
    if (base.protocol !== 'https:') return null;
    const url = new URL(UPSTREAM_PATH, base);
    url.search = new URL(request.url).search;
    return url;
  } catch {
    return null;
  }
}

async function proxyUpstream(request: Request, raw?: Uint8Array) {
  const url = upstreamUrl(request);
  if (!url) return null;
  const headers = new Headers();
  for (const name of ['accept', 'authorization', 'content-type', 'cookie', 'user-agent', 'x-hub-signature-256']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const incoming = new URL(request.url);
  headers.set('x-forwarded-host', incoming.host);
  headers.set('x-forwarded-proto', incoming.protocol.replace(':', ''));

  try {
    return await fetch(url, {
      method: request.method,
      headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : raw,
      redirect: 'manual',
      cache: 'no-store',
    });
  } catch (error) {
    console.error('meta_messaging_upstream_failed', {
      message: error instanceof Error ? error.message : 'unknown',
    });
    return null;
  }
}

export async function GET(request: Request) {
  const incoming = new URL(request.url);
  const mode = incoming.searchParams.get('hub.mode');
  const token = incoming.searchParams.get('hub.verify_token');
  const challenge = incoming.searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token && challenge) {
    const db = createSupabaseServiceClient();
    const { data: config } = await db
      .from('integraciones_secretas')
      .select('wa_verify_token')
      .eq('id', 'global')
      .maybeSingle();
    const expected = process.env.META_WEBHOOK_VERIFY_TOKEN || config?.wa_verify_token;
    if (expected && token === expected) return new Response(challenge, { status: 200 });
  }

  const upstream = await proxyUpstream(request);
  if (!upstream) return new Response('Verificación fallida', { status: 403 });
  return new Response(upstream.body, { status: upstream.status, headers: upstream.headers });
}

export async function POST(request: Request) {
  const bytes = new Uint8Array(await request.arrayBuffer());
  const raw = new TextDecoder().decode(bytes);

  // Keep the legacy destination alive in parallel. Our response to Meta is
  // determined locally only for Instagram payloads.
  const upstreamPromise = proxyUpstream(request, bytes);

  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    await upstreamPromise;
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (payload?.object !== 'instagram') {
    const upstream = await upstreamPromise;
    if (!upstream) return Response.json({ error: 'meta_proxy_unavailable' }, { status: 502 });
    return new Response(upstream.body, { status: upstream.status, headers: upstream.headers });
  }

  if (!verifyHmac(raw, request.headers.get('x-hub-signature-256'), process.env.META_APP_SECRET)) {
    await upstreamPromise;
    return Response.json({ error: 'invalid_signature' }, { status: 401 });
  }

  const db = createSupabaseServiceClient();
  let stored = 0;
  let duplicates = 0;
  try {
    for (const message of normalizeMetaInstagram(payload)) {
      const result = await persistMessage(db, message);
      result.duplicate ? (duplicates += 1) : (stored += 1);
    }
    await upstreamPromise;
    return Response.json({ ok: true, stored, duplicates, ai_called: false });
  } catch (error) {
    await upstreamPromise;
    console.error('instagram_webhook_persist_failed', {
      message: error instanceof Error ? error.message : 'unknown',
    });
    return Response.json({ error: 'persist_failed' }, { status: 500 });
  }
}
