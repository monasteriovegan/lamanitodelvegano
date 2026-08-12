import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { normalizeMetaWhatsApp } from '@/lib/messaging/normalize';
import { persistMessage } from '@/lib/messaging/messages';
import { verifyHmac } from '@/lib/messaging/signature';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const supabase = createSupabaseServiceClient();
  const { data: config } = await supabase
    .from('integraciones_secretas')
    .select('wa_verify_token')
    .eq('id', 'global')
    .maybeSingle();

  const expected = process.env.META_WEBHOOK_VERIFY_TOKEN || config?.wa_verify_token;
  if (mode === 'subscribe' && token && expected && token === expected) {
    return new Response(challenge, { status: 200 });
  }

  return new Response('Verificación fallida', { status: 403 });
}

export async function POST(request: Request) {
  const raw = await request.text();
  if (!verifyHmac(raw, request.headers.get('x-hub-signature-256'), process.env.META_APP_SECRET)) {
    return Response.json({ error: 'invalid_signature' }, { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }

  const db = createSupabaseServiceClient();
  let stored = 0;
  let duplicates = 0;
  let statuses = 0;

  try {
    for (const message of normalizeMetaWhatsApp(payload)) {
      if (message.message_type.startsWith('status:')) {
        statuses += 1;
        await db.from('messaging_transport_status').upsert({
          transport: 'cloud_api',
          status: 'connected',
          updated_at: new Date().toISOString(),
        });
        continue;
      }
      const result = await persistMessage(db, message);
      result.duplicate ? (duplicates += 1) : (stored += 1);
    }
    return Response.json({ ok: true, stored, duplicates, statuses, ai_called: false });
  } catch (error) {
    console.error('whatsapp_webhook_persist_failed', {
      message: error instanceof Error ? error.message : 'unknown',
    });
    return Response.json({ error: 'persist_failed' }, { status: 500 });
  }
}
