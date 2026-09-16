import { createHash, timingSafeEqual } from 'node:crypto';
import { createSupabaseServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function storedImageUrl(db: ReturnType<typeof createSupabaseServiceClient>, messageId: string) {
  const bucket = db.storage.from('omnichannel-media');
  for (const channel of ['whatsapp', 'instagram']) {
    for (const ext of ['jpg', 'png', 'webp']) {
      const path = `inbound/${channel}/${messageId}.${ext}`;
      const { data, error } = await bucket.createSignedUrl(path, 120);
      if (!error && data?.signedUrl) return { path, url: data.signedUrl };
    }
  }
  return null;
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

  const stored = await storedImageUrl(db, messageId);
  if (!stored) return Response.json({ error: 'media_not_found' }, { status: 404 });

  const groqKey = String(process.env.GROQ_API_KEY || '').trim();
  if (!groqKey) return Response.json({ error: 'groq_not_configured' }, { status: 503 });

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${groqKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'qwen/qwen3.6-27b',
      temperature: 0,
      max_completion_tokens: 500,
      response_format: { type: 'json_object' },
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Lee este comprobante de pago con máxima precisión. Devuelve JSON con: isReceipt boolean, amount integer CLP, bank string, sender string, recipient string, date string, transactionId string, visibleText string. No estimes ni calcules montos: amount debe ser únicamente el monto transferido visible; si no se puede leer con seguridad usa null.',
          },
          { type: 'image_url', image_url: { url: stored.url } },
        ],
      }],
    }),
    cache: 'no-store',
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('targeted_receipt_read_failed', { messageId, status: response.status });
    return Response.json({ error: 'vision_provider_failed', status: response.status }, { status: 502 });
  }

  const raw = body?.choices?.[0]?.message?.content || '{}';
  let result: Record<string, unknown>;
  try {
    result = JSON.parse(String(raw));
  } catch {
    result = { visibleText: String(raw).slice(0, 2000) };
  }

  return Response.json({ ok: true, messageId, path: stored.path, result });
}
