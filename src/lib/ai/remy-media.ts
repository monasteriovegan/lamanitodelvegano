import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { NormalizedMessage } from '@/lib/messaging/types';
import { recordGeminiUsage } from '@/lib/observability/usage';

const SUPPORTED_MEDIA = new Set(['audio', 'image', 'video', 'document']);
const MAX_INLINE_BYTES = 15 * 1024 * 1024;
const MODEL = 'gemini-2.5-flash';

function mediaDescriptor(inbound: NormalizedMessage) {
  if (!SUPPORTED_MEDIA.has(inbound.message_type)) return null;
  const raw = inbound.raw_payload as any;
  const message = raw?.message || raw?.message_echo || {};
  const media = message?.[inbound.message_type] || {};
  const id = String(media?.id || '').trim();
  if (!id) return null;
  return {
    id,
    caption: String(media?.caption || '').trim(),
    fileName: String(media?.filename || '').trim(),
    declaredMime: String(media?.mime_type || '').trim(),
  };
}

function instructionFor(type: string, caption: string, fileName: string) {
  const context = [caption ? `Texto/caption del cliente: ${caption}` : '', fileName ? `Archivo: ${fileName}` : ''].filter(Boolean).join('\n');
  const task = type === 'audio'
    ? 'Transcribe fielmente lo que dice el cliente y resume en una frase qué necesita.'
    : type === 'image'
      ? 'Describe solo lo comercialmente relevante de la imagen, incluyendo texto visible, producto, comprobante o problema que el cliente intenta mostrar.'
      : type === 'video'
        ? 'Resume lo comercialmente relevante del video y qué parece necesitar el cliente.'
        : 'Extrae y resume la información comercialmente relevante del documento.';
  return `${task}\n${context}\nResponde en español, texto plano, máximo 700 caracteres. No inventes nada que no esté en el archivo.`;
}

export async function understandWhatsAppMedia(
  db: SupabaseClient,
  inbound: NormalizedMessage,
  context: { businessUnitId: string; conversationId?: string | null },
) {
  const media = mediaDescriptor(inbound);
  if (!media) return null;

  const { data: config } = await db.from('integraciones_secretas')
    .select('ai_enabled,wa_access_token,gemini_api_key')
    .eq('id', 'global')
    .maybeSingle();
  if (!config?.ai_enabled) return null;
  const waToken = String(config?.wa_access_token || '').trim();
  const geminiKey = String(config?.gemini_api_key || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
  if (!waToken) throw new Error('whatsapp_media_token_missing');
  if (!geminiKey) throw new Error('media_understanding_gemini_missing');

  const version = process.env.META_GRAPH_VERSION || 'v26.0';
  const metadataResponse = await fetch(`https://graph.facebook.com/${version}/${encodeURIComponent(media.id)}`, {
    headers: { Authorization: `Bearer ${waToken}` },
    cache: 'no-store',
  });
  const metadata = await metadataResponse.json().catch(() => ({}));
  if (!metadataResponse.ok || !metadata?.url) throw new Error(`whatsapp_media_metadata_failed:${metadataResponse.status}`);
  if (Number(metadata?.file_size || 0) > MAX_INLINE_BYTES) throw new Error('whatsapp_media_too_large');

  const mediaResponse = await fetch(String(metadata.url), {
    headers: { Authorization: `Bearer ${waToken}` },
    cache: 'no-store',
  });
  if (!mediaResponse.ok) throw new Error(`whatsapp_media_download_failed:${mediaResponse.status}`);
  const bytes = new Uint8Array(await mediaResponse.arrayBuffer());
  if (bytes.byteLength > MAX_INLINE_BYTES) throw new Error('whatsapp_media_too_large');

  const mimeType = String(metadata?.mime_type || media.declaredMime || mediaResponse.headers.get('content-type') || 'application/octet-stream').split(';')[0];
  const payload = {
    contents: [{
      role: 'user',
      parts: [
        { text: instructionFor(inbound.message_type, media.caption, media.fileName) },
        { inlineData: { mimeType, data: Buffer.from(bytes).toString('base64') } },
      ],
    }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 180 },
  };

  const started = Date.now();
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`media_understanding_failed:${response.status}`);
  const parts = Array.isArray(body?.candidates?.[0]?.content?.parts) ? body.candidates[0].content.parts : [];
  const understood = parts.map((part: any) => typeof part?.text === 'string' ? part.text : '').join('').trim();
  if (!understood) throw new Error('media_understanding_empty');

  await recordGeminiUsage(db, {
    businessUnitId: context.businessUnitId,
    conversationId: context.conversationId || null,
    agent: 'remy',
    model: MODEL,
    usage: body?.usageMetadata,
    latencyMs: Date.now() - started,
    metadata: { channel: 'whatsapp', operation: 'media_understanding', message_type: inbound.message_type, mime_type: mimeType },
  });

  return `[${inbound.message_type.toUpperCase()} DEL CLIENTE]\n${understood}`;
}
