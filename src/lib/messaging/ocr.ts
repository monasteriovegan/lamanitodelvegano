import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { NormalizedMessage } from '@/lib/messaging/types';

const MODEL = 'gemini-2.5-flash';
const MAX_BYTES = 15 * 1024 * 1024;

export type ExtractedMediaText = {
  text: string;
  isReceipt: boolean;
  detectedAmounts: number[];
  detectedBank?: string;
  detectedSender?: string;
};

export async function extractTextFromImageBytes(
  geminiKey: string,
  imageBytes: Uint8Array,
  mimeType = 'image/jpeg',
): Promise<ExtractedMediaText> {
  const prompt = `Analiza esta imagen y realiza un OCR comercial exhaustivo.
Extrae TODO el texto visible, números de transacción, códigos de referencia, montos en pesos/CLP, nombres de remitente/titular, banco y detalles de transferencias o comprobantes de pago.
Devuelve un JSON con este formato exacto:
{
  "text": "transcripción completa de todo el texto visible",
  "isReceipt": true/false (si es un comprobante de transferencia/pago/boleta),
  "detectedAmounts": [22950, 20000] (lista de números enteros de los montos encontrados),
  "detectedBank": "nombre del banco si aparece",
  "detectedSender": "nombre del remitente si aparece"
}`;

  const payload = {
    contents: [{
      role: 'user',
      parts: [
        { text: prompt },
        { inlineData: { mimeType: mimeType.split(';')[0], data: Buffer.from(imageBytes).toString('base64') } },
      ],
    }],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
    },
  };

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(geminiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`ocr_gemini_failed:${response.status}`);
  }

  const body = await response.json().catch(() => ({}));
  const rawText = body?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  try {
    const parsed = JSON.parse(rawText);
    return {
      text: String(parsed.text || '').trim(),
      isReceipt: Boolean(parsed.isReceipt),
      detectedAmounts: Array.isArray(parsed.detectedAmounts) ? parsed.detectedAmounts.map(Number).filter(Number.isFinite) : [],
      detectedBank: parsed.detectedBank ? String(parsed.detectedBank) : undefined,
      detectedSender: parsed.detectedSender ? String(parsed.detectedSender) : undefined,
    };
  } catch {
    return {
      text: rawText.slice(0, 1000),
      isReceipt: false,
      detectedAmounts: [],
    };
  }
}

export async function persistMediaToStorage(
  db: SupabaseClient,
  input: {
    messageId: string;
    channel: string;
    imageBytes: Uint8Array;
    mimeType: string;
  }
): Promise<{ storagePath: string; storageUrl?: string } | null> {
  try {
    const ext = input.mimeType.includes('png') ? 'png' : input.mimeType.includes('webp') ? 'webp' : 'jpg';
    const filePath = `inbound/${input.channel}/${input.messageId}.${ext}`;

    const { error } = await db.storage
      .from('omnichannel-media')
      .upload(filePath, input.imageBytes, {
        contentType: input.mimeType,
        upsert: true,
      });

    if (error) {
      // Si el bucket no existe aún, se registra sin interrumpir el flujo OCR
      console.warn('supabase_media_storage_warning', { error: error.message, filePath });
      return null;
    }

    const { data: urlData } = db.storage.from('omnichannel-media').getPublicUrl(filePath);
    return {
      storagePath: filePath,
      storageUrl: urlData?.publicUrl,
    };
  } catch (err) {
    console.error('persist_media_storage_failed', { error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}

export async function processInboundImageOcrAsync(
  db: SupabaseClient,
  messageId: string,
  message: NormalizedMessage,
): Promise<void> {
  try {
    const { data: config } = await db.from('integraciones_secretas')
      .select('gemini_api_key,wa_access_token')
      .eq('id', 'global')
      .maybeSingle();

    const geminiKey = String(config?.gemini_api_key || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
    if (!geminiKey) return;

    let imageBytes: Uint8Array | null = null;
    let mimeType = 'image/jpeg';

    if (message.channel === 'whatsapp') {
      const raw = message.raw_payload as any;
      const media = raw?.message?.image || raw?.image || {};
      const mediaId = String(media?.id || '').trim();
      const waToken = String(config?.wa_access_token || '').trim();
      if (!mediaId || !waToken) return;

      const version = process.env.META_GRAPH_VERSION || 'v26.0';
      const metaRes = await fetch(`https://graph.facebook.com/${version}/${encodeURIComponent(mediaId)}`, {
        headers: { Authorization: `Bearer ${waToken}` },
        cache: 'no-store',
      });
      const metaJson = await metaRes.json().catch(() => ({}));
      if (!metaRes.ok || !metaJson?.url) return;

      const dlRes = await fetch(String(metaJson.url), {
        headers: { Authorization: `Bearer ${waToken}` },
        cache: 'no-store',
      });
      if (!dlRes.ok) return;
      imageBytes = new Uint8Array(await dlRes.arrayBuffer());
      mimeType = String(metaJson?.mime_type || dlRes.headers.get('content-type') || 'image/jpeg');
    } else if (message.channel === 'instagram') {
      const raw = message.raw_payload as any;
      const url = raw?.attachments?.[0]?.payload?.url || raw?.message?.attachments?.[0]?.payload?.url;
      if (!url) return;

      const dlRes = await fetch(url, { cache: 'no-store' });
      if (!dlRes.ok) return;
      imageBytes = new Uint8Array(await dlRes.arrayBuffer());
      mimeType = String(dlRes.headers.get('content-type') || 'image/jpeg');
    }

    if (!imageBytes || imageBytes.byteLength > MAX_BYTES) return;

    // 1. Guardar permanentemente en almacenamiento privado si está disponible
    const storageResult = await persistMediaToStorage(db, {
      messageId,
      channel: message.channel,
      imageBytes,
      mimeType,
    });

    // 2. Extraer texto y montos estructurados con Gemini Flash
    const result = await extractTextFromImageBytes(geminiKey, imageBytes, mimeType);

    // 3. Persistir en la base de datos
    const { data: currentMsg } = await db.from('omnichannel_messages').select('payload').eq('id', messageId).maybeSingle();
    const payload = currentMsg?.payload && typeof currentMsg.payload === 'object' ? currentMsg.payload : {};

    await db.from('omnichannel_messages').update({
      payload: {
        ...payload,
        storage_path: storageResult?.storagePath || payload.storage_path || null,
        storage_url: storageResult?.storageUrl || payload.storage_url || null,
        ocr_text: result.text,
        ocr_is_receipt: result.isReceipt,
        ocr_detected_amounts: result.detectedAmounts,
        ocr_bank: result.detectedBank,
        ocr_sender: result.detectedSender,
        ocr_processed_at: new Date().toISOString(),
      },
    }).eq('id', messageId);
  } catch (err) {
    console.error('inbound_image_ocr_failed', { messageId, error: err instanceof Error ? err.message : String(err) });
  }
}

export type BackfillResult = {
  totalHistorical: number;
  retrievable: number;
  processed: number;
  expiredUnavailable: number;
  failed: number;
  matchesFor22950: Array<{
    messageId: string;
    conversationId: string;
    channel: string;
    sentAt: string;
    ocrText: string;
    detectedAmounts: number[];
  }>;
};

export async function runHistoricalMediaBackfill(
  db: SupabaseClient,
  options: { limit?: number; days?: number } = {},
): Promise<BackfillResult> {
  const limit = options.limit || 50;
  const days = options.days || 90;
  const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  // Buscar mensajes tipo imagen que aún no tengan OCR procesado
  const { data: rawMessages, error } = await db.from('omnichannel_messages')
    .select('id,conversation_id,customer_id,direction,message_type,body,provider,sent_at,created_at,payload,raw_payload')
    .eq('message_type', 'image')
    .gte('created_at', sinceDate)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  const messagesToProcess = (rawMessages || []).filter((m: any) => !m.payload?.ocr_processed_at);

  let retrievable = 0;
  let processed = 0;
  let expiredUnavailable = 0;
  let failed = 0;
  const matchesFor22950: BackfillResult['matchesFor22950'] = [];

  const { data: config } = await db.from('integraciones_secretas')
    .select('gemini_api_key,wa_access_token')
    .eq('id', 'global')
    .maybeSingle();

  const geminiKey = String(config?.gemini_api_key || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
  const waToken = String(config?.wa_access_token || '').trim();

  for (const msg of messagesToProcess) {
    try {
      let imageBytes: Uint8Array | null = null;
      let mimeType = 'image/jpeg';
      const channel = msg.provider === 'meta' ? 'whatsapp' : (msg.provider || 'whatsapp');

      if (channel === 'whatsapp') {
        const raw = msg.raw_payload as any;
        const media = raw?.message?.image || raw?.image || {};
        const mediaId = String(media?.id || '').trim();
        if (!mediaId || !waToken) {
          expiredUnavailable += 1;
          continue;
        }

        const version = process.env.META_GRAPH_VERSION || 'v26.0';
        const metaRes = await fetch(`https://graph.facebook.com/${version}/${encodeURIComponent(mediaId)}`, {
          headers: { Authorization: `Bearer ${waToken}` },
          cache: 'no-store',
        });
        const metaJson = await metaRes.json().catch(() => ({}));
        if (!metaRes.ok || !metaJson?.url) {
          expiredUnavailable += 1;
          continue;
        }

        const dlRes = await fetch(String(metaJson.url), {
          headers: { Authorization: `Bearer ${waToken}` },
          cache: 'no-store',
        });
        if (!dlRes.ok) {
          expiredUnavailable += 1;
          continue;
        }
        imageBytes = new Uint8Array(await dlRes.arrayBuffer());
        mimeType = String(metaJson?.mime_type || dlRes.headers.get('content-type') || 'image/jpeg');
      } else {
        const raw = msg.raw_payload as any;
        const url = raw?.attachments?.[0]?.payload?.url || raw?.message?.attachments?.[0]?.payload?.url;
        if (!url) {
          expiredUnavailable += 1;
          continue;
        }

        const dlRes = await fetch(url, { cache: 'no-store' });
        if (!dlRes.ok) {
          expiredUnavailable += 1;
          continue;
        }
        imageBytes = new Uint8Array(await dlRes.arrayBuffer());
        mimeType = String(dlRes.headers.get('content-type') || 'image/jpeg');
      }

      retrievable += 1;

      if (!imageBytes || !geminiKey) {
        failed += 1;
        continue;
      }

      // Persistir permanentemente en storage
      const storageResult = await persistMediaToStorage(db, {
        messageId: msg.id,
        channel,
        imageBytes,
        mimeType,
      });

      // Extraer texto
      const ocrResult = await extractTextFromImageBytes(geminiKey, imageBytes, mimeType);

      const payload = msg.payload && typeof msg.payload === 'object' ? msg.payload : {};
      await db.from('omnichannel_messages').update({
        payload: {
          ...payload,
          storage_path: storageResult?.storagePath || payload.storage_path || null,
          storage_url: storageResult?.storageUrl || payload.storage_url || null,
          ocr_text: ocrResult.text,
          ocr_is_receipt: ocrResult.isReceipt,
          ocr_detected_amounts: ocrResult.detectedAmounts,
          ocr_bank: ocrResult.detectedBank,
          ocr_sender: ocrResult.detectedSender,
          ocr_processed_at: new Date().toISOString(),
        },
      }).eq('id', msg.id);

      processed += 1;

      if (ocrResult.detectedAmounts.includes(22950) || ocrResult.text.includes('22.950') || ocrResult.text.includes('22950')) {
        matchesFor22950.push({
          messageId: msg.id,
          conversationId: msg.conversation_id,
          channel,
          sentAt: msg.sent_at || msg.created_at,
          ocrText: ocrResult.text,
          detectedAmounts: ocrResult.detectedAmounts,
        });
      }
    } catch (err) {
      console.error('backfill_message_failed', { messageId: msg.id, error: err });
      failed += 1;
    }
  }

  return {
    totalHistorical: messagesToProcess.length,
    retrievable,
    processed,
    expiredUnavailable,
    failed,
    matchesFor22950,
  };
}
