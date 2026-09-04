import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { callAiProvider } from '@/lib/ai/providers';
import { getAgentRuntimeConfig } from '@/lib/ai/runtime-config';
import type { ConversationSaleDraft } from '@/lib/orders/conversation-sale';
import type { InstagramPaymentMessage } from '@/lib/orders/instagram-auto-sale-signals';

type DraftItem = ConversationSaleDraft['items'][number];

export type ConfirmedOffCatalogCandidate = {
  productName: string;
  quantity: number;
  customUnitPrice: number | null;
};

type ReviewableDraftItem = DraftItem & { requiresPricingReview?: boolean };

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeName(value: unknown) {
  return clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-CL')
    .replace(/\s+/g, ' ');
}

function positiveInteger(value: unknown) {
  const parsed = Math.floor(Number(value || 0));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function positiveMoney(value: unknown): number | null {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
}

/**
 * Merge determinista para la ruta de rescate de una venta ya confirmada.
 * Nunca inventa precio: usa el precio explícito del candidato, o puede resolver
 * una única línea por residual cuando existe un total final explícito. Si no,
 * la línea queda a $0 y marcada para revisión; la transferencia permanece
 * pendiente hasta que un admin valide precio/total y confirme el pago.
 */
export function mergeConfirmedOffCatalogCandidates(
  draft: ConversationSaleDraft,
  rawCandidates: ConfirmedOffCatalogCandidate[],
): ConversationSaleDraft {
  const existingNames = new Set((draft.items || []).map((item) => normalizeName(item.productName)).filter(Boolean));
  const candidates = (rawCandidates || []).flatMap((candidate) => {
    const productName = clean(candidate.productName);
    const quantity = positiveInteger(candidate.quantity);
    if (!productName || !quantity || existingNames.has(normalizeName(productName))) return [];
    existingNames.add(normalizeName(productName));
    return [{
      productName,
      quantity,
      customUnitPrice: positiveMoney(candidate.customUnitPrice),
    }];
  });
  if (!candidates.length) return draft;

  const explicitCandidateSubtotal = candidates
    .filter((candidate) => candidate.customUnitPrice != null)
    .reduce((sum, candidate) => sum + Number(candidate.customUnitPrice) * candidate.quantity, 0);
  const unresolvedCustomItems = candidates.filter((candidate) => candidate.customUnitPrice == null);

  if (unresolvedCustomItems.length === 1 && draft.transcriptTotal && draft.calculated) {
    const unresolved = unresolvedCustomItems[0];
    const residual = Number(draft.transcriptTotal) - Number(draft.calculated.total) - explicitCandidateSubtotal;
    const exactUnitPrice = residual / unresolved.quantity;
    const roundedUnitPrice = Math.round(exactUnitPrice);
    if (residual > 0 && roundedUnitPrice > 0 && Math.abs(exactUnitPrice - roundedUnitPrice) < 0.01) {
      unresolved.customUnitPrice = roundedUnitPrice;
    }
  }

  const reviewNames: string[] = [];
  const additions: ReviewableDraftItem[] = candidates.map((candidate) => {
    const requiresPricingReview = candidate.customUnitPrice == null;
    if (requiresPricingReview) reviewNames.push(candidate.productName);
    return {
      productId: null,
      productName: requiresPricingReview ? `${candidate.productName} [PRECIO POR REVISAR]` : candidate.productName,
      quantity: candidate.quantity,
      format: null,
      variety: null,
      customUnitPrice: candidate.customUnitPrice ?? 0,
      isCustom: true,
      requiresPricingReview,
    };
  });

  const pricingReview = reviewNames.length > 0;
  const reviewNote = pricingReview
    ? `[REQUIERE REVISIÓN PRECIO/TOTAL: ${reviewNames.join(', ')}. Venta confirmada en conversación; no marcar transferencia como pagada hasta completar el importe.]`
    : '';
  const notes = [draft.notes, reviewNote].filter(Boolean).join(' ').trim();
  const missing = (draft.missing || []).filter((item) => ![
    'productos',
    'validacion_pedido',
    'total_no_coincide',
  ].includes(item));

  return {
    ...draft,
    items: [...(draft.items || []), ...additions],
    notes,
    // Si aún falta repartir precio, no usamos un total explícito como si las
    // líneas ya cuadraran. El pedido queda visible y revisable, no falseado.
    transcriptTotal: pricingReview ? null : draft.transcriptTotal,
    missing,
  };
}

function compactTranscript(messages: InstagramPaymentMessage[]) {
  return messages
    .slice(-100)
    .flatMap((message) => {
      const actor = message.direction === 'inbound' ? 'CLIENTE' : 'NEGOCIO';
      const body = clean(message.body);
      if (body) return [`${actor}: ${body.slice(0, 800)}`];
      if (message.direction === 'inbound' && ['image', 'document'].includes(String(message.message_type || ''))) {
        return [`${actor}: [COMPROBANTE O ARCHIVO ADJUNTO]`];
      }
      return [];
    })
    .join('\n')
    .slice(-12000);
}

/**
 * Segunda pasada muy acotada: sólo intenta detectar productos explícitamente
 * vendidos que quedaron fuera del catálogo activo y, por eso, no llegaron al
 * borrador principal. No crea pedidos ni decide pagos.
 */
export async function augmentConfirmedOffCatalogDraft(
  db: SupabaseClient,
  draft: ConversationSaleDraft,
  messages: InstagramPaymentMessage[],
): Promise<ConversationSaleDraft> {
  const transcript = compactTranscript(messages);
  if (!transcript) return draft;

  const { data: conversation, error: conversationError } = await db
    .from('conversations')
    .select('business_unit_id')
    .eq('id', draft.conversationId)
    .maybeSingle();
  if (conversationError) throw conversationError;
  if (!conversation?.business_unit_id) return draft;

  const { data: products, error: productsError } = await db
    .from('productos')
    .select('nombre')
    .eq('business_unit_id', conversation.business_unit_id)
    .eq('activo', true)
    .order('nombre');
  if (productsError) throw productsError;

  const runtime = await getAgentRuntimeConfig(db, 'remy', {
    provider: 'groq', model: 'openai/gpt-oss-20b', executionMode: 'api',
  });
  if (runtime.executionMode !== 'api') return draft;

  const tool = {
    name: 'extract_missing_offcatalog_items',
    description: 'Extrae sólo productos vendidos que no están en el catálogo activo y que faltan del borrador ya extraído.',
    inputSchema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              productName: { type: 'string' },
              quantity: { type: 'number', minimum: 1 },
              customUnitPrice: { type: 'number', minimum: 0 },
            },
            required: ['productName', 'quantity', 'customUnitPrice'],
          },
        },
      },
      required: ['items'],
    },
  };

  const activeCatalogNames = (products || []).map((product) => String(product.nombre || '')).filter(Boolean);
  const alreadyExtracted = (draft.items || []).map((item) => item.productName).filter(Boolean);
  const response = await callAiProvider(db, {
    provider: runtime.provider,
    model: runtime.model,
    systemPrompt: `Revisas una venta YA CONFIRMADA para rescatar únicamente líneas que quedaron fuera del catálogo activo.\nReglas:\n- No inventes productos, cantidades ni precios.\n- Devuelve sólo productos explícitamente pedidos en la conversación que NO correspondan a los nombres del catálogo activo y que NO estén ya en el borrador.\n- Si el precio unitario está explícito, úsalo. Si no está explícito, customUnitPrice=0.\n- No devuelvas despacho, totales, medios de pago ni productos del catálogo.\n- Si no hay líneas fuera de catálogo, items=[].\nDebes llamar a extract_missing_offcatalog_items una sola vez.`,
    messages: [{ role: 'user', content: `CATÁLOGO ACTIVO:\n${JSON.stringify(activeCatalogNames)}\n\nYA EXTRAÍDO:\n${JSON.stringify(alreadyExtracted)}\n\nCONVERSACIÓN:\n${transcript}` }],
    tools: [tool],
    maxOutputTokens: 260,
    temperature: 0,
  });

  const args = response.toolCalls.find((call) => call.name === 'extract_missing_offcatalog_items')?.args;
  const candidates: ConfirmedOffCatalogCandidate[] = Array.isArray(args?.items)
    ? args.items.map((item: any) => ({
      productName: clean(item?.productName),
      quantity: positiveInteger(item?.quantity),
      customUnitPrice: positiveMoney(item?.customUnitPrice),
    })).filter((item: ConfirmedOffCatalogCandidate) => item.productName && item.quantity > 0)
    : [];

  return mergeConfirmedOffCatalogCandidates(draft, candidates);
}
