import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { extractTextFromImageBytes, persistMediaToStorage } from '@/lib/messaging/ocr';

const MAX_BYTES = 15 * 1024 * 1024;

export type HistoricalMediaBackfillResult = {
  totalHistorical: number;
  retrievable: number;
  processed: number;
  expiredUnavailable: number;
  failed: number;
  processedMessages: Array<{
    messageId: string;
    conversationId: string;
    channel: 'whatsapp' | 'instagram';
    detectedAmounts: number[];
    detectedBank?: string;
    detectedSender?: string;
  }>;
};

export async function runHistoricalMediaBackfillV2(
  db: SupabaseClient,
  options: { limit?: number; days?: number } = {},
): Promise<HistoricalMediaBackfillResult> {
  const limit = Math.max(1, Math.min(Number(options.limit || 50), 100));
  const days = Math.max(1, Math.min(Number(options.days || 90), 365));
  const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data: rawMessages, error } = await db.from('omnichannel_messages')
    .select('id,conversation_id,message_type,provider,transport,sent_at,created_at,payload')
    .eq('message_type', 'image')
    .gte('created_at', sinceDate)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;

  const messagesToProcess = (rawMessages || []).filter((m: any) => !m.payload?.ocr_processed_at);
  const { data: config } = await db.from('integraciones_secretas')
    .select('gemini_api_key,wa_access_token')
    .eq('id', 'global')
    .maybeSingle();

  const geminiKey = String(config?.gemini_api_key || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
  const waToken = String(config?.wa_access_token || '').trim();

  let retrievable = 0;
  let processed = 0;
  let expiredUnavailable = 0;
  let failed = 0;
  const processedMessages: HistoricalMediaBackfillResult['processedMessages'] = [];

  for (const msg of messagesToProcess as any[]) {
    try {
      const channel = msg.transport === 'cloud_api'
        ? 'whatsapp'
        : msg.transport === 'instagram_api'
          ? 'instagram'
          : null;
      if (!channel) {
        failed += 1;
        continue;
      }

      let imageBytes: Uint8Array | null = null;
      let mimeType = 'image/jpeg';
      const raw = msg.payload?.raw || msg.payload || {};

      if (channel === 'whatsapp') {
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
        const url = raw?.attachments?.[0]?.payload?.url || raw?.message?.attachments?.[0]?.payload?.url;
        if (!url) {
          expiredUnavailable += 1;
          continue;
        }
        const dlRes = await fetch(String(url), { cache: 'no-store' });
        if (!dlRes.ok) {
          expiredUnavailable += 1;
          continue;
        }
        imageBytes = new Uint8Array(await dlRes.arrayBuffer());
        mimeType = String(dlRes.headers.get('content-type') || 'image/jpeg');
      }

      retrievable += 1;
      if (!imageBytes || imageBytes.byteLength > MAX_BYTES || !geminiKey) {
        failed += 1;
        continue;
      }

      const storageResult = await persistMediaToStorage(db, {
        messageId: String(msg.id),
        channel,
        imageBytes,
        mimeType,
      });
      const ocrResult = await extractTextFromImageBytes(geminiKey, imageBytes, mimeType);
      const payload = msg.payload && typeof msg.payload === 'object' ? msg.payload : {};

      const { error: updateError } = await db.from('omnichannel_messages').update({
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
      if (updateError) throw updateError;

      processed += 1;
      processedMessages.push({
        messageId: String(msg.id),
        conversationId: String(msg.conversation_id),
        channel,
        detectedAmounts: ocrResult.detectedAmounts,
        detectedBank: ocrResult.detectedBank,
        detectedSender: ocrResult.detectedSender,
      });
    } catch (err) {
      console.error('historical_media_backfill_message_failed', {
        messageId: String(msg?.id || ''),
        reason: err instanceof Error ? err.message : 'unknown',
      });
      failed += 1;
    }
  }

  return {
    totalHistorical: messagesToProcess.length,
    retrievable,
    processed,
    expiredUnavailable,
    failed,
    processedMessages,
  };
}
