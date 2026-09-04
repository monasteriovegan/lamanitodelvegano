import { createHash, timingSafeEqual } from 'node:crypto';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function GET(request: Request) {
  const db = createSupabaseServiceClient();
  const { data: config, error: configError } = await db
    .from('integraciones_secretas')
    .select('wa_verify_token')
    .eq('id', 'global')
    .maybeSingle();
  if (configError) return Response.json({ error: 'config_read_failed' }, { status: 500 });

  const url = new URL(request.url);
  const key = request.headers.get('x-media-backfill-key') || url.searchParams.get('key') || '';
  const secret = String(config?.wa_verify_token || process.env.META_WEBHOOK_VERIFY_TOKEN || '');
  const expected = secret ? createHash('sha256').update(secret).digest('hex') : '';
  if (!key || !expected || !safeEqual(key, expected)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const messageId = String(url.searchParams.get('message_id') || '').trim();
  if (!/^[0-9a-f-]{36}$/i.test(messageId)) {
    return Response.json({ error: 'invalid_message_id' }, { status: 400 });
  }

  const bucket = db.storage.from('omnichannel-media');
  for (const channel of ['whatsapp', 'instagram']) {
    for (const ext of ['jpg', 'png', 'webp']) {
      const path = `inbound/${channel}/${messageId}.${ext}`;
      const { data, error } = await bucket.createSignedUrl(path, 120);
      if (!error && data?.signedUrl) {
        return Response.json({ ok: true, path, signedUrl: data.signedUrl });
      }
    }
  }

  return Response.json({ error: 'media_not_found' }, { status: 404 });
}
