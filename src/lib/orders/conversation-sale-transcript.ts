type ConversationTranscriptMessage = {
  direction?: string | null;
  body?: string | null;
  message_type?: string | null;
  payload?: Record<string, unknown> | null;
};

function compact(value: unknown, max: number) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return text.length <= max ? text : text.slice(0, max);
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function receiptSummary(payload: Record<string, unknown>) {
  const amounts = Array.isArray(payload.ocr_detected_amounts)
    ? payload.ocr_detected_amounts
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0)
        .map((value) => Math.round(value))
    : [];
  const bank = compact(payload.ocr_bank, 120);
  const sender = compact(payload.ocr_sender, 160);
  const facts = [
    amounts.length ? `montos=${amounts.join(',')}` : '',
    bank ? `banco=${bank}` : '',
    sender ? `remitente=${sender}` : '',
  ].filter(Boolean);
  return `[COMPROBANTE ADJUNTO${facts.length ? `; ${facts.join('; ')}` : ''}]`;
}

export function buildConversationSaleTranscript(messages: ConversationTranscriptMessage[]) {
  const lines = messages.flatMap((message) => {
    const actor = message.direction === 'inbound' ? 'CLIENTE' : 'NEGOCIO';
    const body = compact(message.body, 800);
    const type = String(message.message_type || '').toLowerCase();
    const payload = record(message.payload);
    const isMedia = ['image', 'document'].includes(type);
    const mediaContext: string[] = [];

    if (message.direction === 'inbound' && isMedia) {
      if (payload.ocr_is_receipt === true) {
        mediaContext.push(receiptSummary(payload));
      } else {
        const ocr = compact(payload.ocr_text, 2800);
        mediaContext.push(ocr ? `[TEXTO EXTRAÍDO DE IMAGEN: ${ocr}]` : '[COMPROBANTE O ARCHIVO ADJUNTO]');
      }
    }

    const parts = [body, ...mediaContext].filter(Boolean);
    return parts.length ? [`${actor}: ${parts.join(' ')}`] : [];
  });

  const transcript = lines.join('\n');
  return transcript.length <= 14000 ? transcript : transcript.slice(transcript.length - 14000);
}
