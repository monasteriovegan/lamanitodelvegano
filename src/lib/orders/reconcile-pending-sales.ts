import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { autoRegisterInstagramConversationSale } from '@/lib/orders/instagram-auto-sale';
import { autoRegisterWhatsappConversationSale } from '@/lib/orders/whatsapp-auto-sale';

type ReconcileStatus = 'synced' | 'pending' | 'already_linked' | 'ignored' | 'failed';

type CandidateConversation = {
  id: string;
  channel: 'instagram' | 'whatsapp';
  order_id: number | null;
  labels: string[] | null;
  updated_at: string | null;
};

export type ReconcilePendingSalesOptions = {
  limit?: number;
  hours?: number;
};

export type ReconcilePendingSaleResult = {
  conversationId: string;
  channel: 'instagram' | 'whatsapp';
  status: ReconcileStatus;
  orderId?: number;
  missing?: string[];
  error?: string;
};

export type ReconcilePendingSalesResult = {
  scanned: number;
  synced: number;
  pending: number;
  failed: number;
  results: ReconcilePendingSaleResult[];
};

function boundedInteger(value: number | undefined, fallback: number, min: number, max: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(Math.trunc(numeric), max));
}

function isPersonalOnly(labels: string[] | null | undefined) {
  const normalized = new Set((labels || []).map((label) => String(label).trim().toLowerCase()));
  return normalized.has('personal') && !normalized.has('pedido') && !normalized.has('pagado');
}

async function upsertAttempt(
  db: SupabaseClient,
  previousAttempts: Map<string, number>,
  result: ReconcilePendingSaleResult,
) {
  const now = new Date().toISOString();
  const attempts = (previousAttempts.get(result.conversationId) || 0) + 1;
  previousAttempts.set(result.conversationId, attempts);
  const { error } = await db.from('conversation_reconciliation_state').upsert({
    conversation_id: result.conversationId,
    last_attempt_at: now,
    last_status: result.status,
    missing: result.missing || [],
    attempts,
    last_error: result.error || null,
    updated_at: now,
  }, { onConflict: 'conversation_id' });
  if (error) throw error;
}

export async function reconcilePendingSales(
  db: SupabaseClient,
  options: ReconcilePendingSalesOptions = {},
): Promise<ReconcilePendingSalesResult> {
  const limit = boundedInteger(options.limit, 50, 1, 100);
  const hours = boundedInteger(options.hours, 72, 1, 168);
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const { data: rawCandidates, error: candidateError } = await db
    .from('conversations')
    .select('id,channel,order_id,labels,updated_at')
    .in('channel', ['instagram', 'whatsapp'])
    .gte('updated_at', since)
    .order('updated_at', { ascending: false })
    .limit(Math.min(limit * 3, 300));
  if (candidateError) throw candidateError;

  const typedCandidates = (rawCandidates || []) as CandidateConversation[];
  const notPersonal = typedCandidates.filter((conversation) => !isPersonalOnly(conversation.labels));
  if (!notPersonal.length) {
    return { scanned: 0, synced: 0, pending: 0, failed: 0, results: [] };
  }

  const ids = notPersonal.map((conversation) => conversation.id);
  const [{ data: unlinkedRows, error: unlinkedError }, { data: stateRows, error: stateError }] = await Promise.all([
    db.from('omnichannel_messages')
      .select('conversation_id')
      .in('conversation_id', ids)
      .is('order_id', null),
    db.from('conversation_reconciliation_state')
      .select('conversation_id,attempts')
      .in('conversation_id', ids),
  ]);
  if (unlinkedError) throw unlinkedError;
  if (stateError) throw stateError;

  const hasUnlinkedMessages = new Set((unlinkedRows || []).map((row: { conversation_id: string }) => row.conversation_id));
  const attempts = new Map(
    (stateRows || []).map((row: { conversation_id: string; attempts: number }) => [row.conversation_id, Number(row.attempts || 0)]),
  );

  const candidates = notPersonal
    .filter((conversation) => !conversation.order_id || hasUnlinkedMessages.has(conversation.id))
    .slice(0, limit);

  const results: ReconcilePendingSaleResult[] = [];
  for (const conversation of candidates) {
    try {
      const outcome = conversation.channel === 'instagram'
        ? await autoRegisterInstagramConversationSale(db, conversation.id)
        : await autoRegisterWhatsappConversationSale(db, conversation.id);
      const result: ReconcilePendingSaleResult = {
        conversationId: conversation.id,
        channel: conversation.channel,
        status: outcome.status,
        ...(outcome.orderId ? { orderId: Number(outcome.orderId) } : {}),
        ...(outcome.missing?.length ? { missing: outcome.missing.map(String) } : {}),
      };
      results.push(result);
      await upsertAttempt(db, attempts, result);
    } catch (error) {
      const result: ReconcilePendingSaleResult = {
        conversationId: conversation.id,
        channel: conversation.channel,
        status: 'failed',
        error: error instanceof Error ? error.message : 'unknown_reconciliation_error',
      };
      results.push(result);
      try {
        await upsertAttempt(db, attempts, result);
      } catch (stateError) {
        console.error('conversation_reconciliation_state_write_failed', {
          conversationId: conversation.id,
          reason: stateError instanceof Error ? stateError.message : 'unknown',
        });
      }
    }
  }

  return {
    scanned: results.length,
    synced: results.filter((result) => result.status === 'synced').length,
    pending: results.filter((result) => result.status === 'pending').length,
    failed: results.filter((result) => result.status === 'failed').length,
    results,
  };
}