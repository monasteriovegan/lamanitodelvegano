import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

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
