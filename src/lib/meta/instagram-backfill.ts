import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { persistMessage } from '@/lib/messaging/messages';
import type { NormalizedMessage } from '@/lib/messaging/types';
import { autoRegisterInstagramConversationSale } from '@/lib/orders/instagram-auto-sale';
import { loadActiveMetaConnectionToken } from '@/lib/meta/connection-token';

const DEFAULT_PAGE_ID = '1210803402107834';
const DEFAULT_IG_BUSINESS_ID = '17841419477422736';
const DEFAULT_BUSINESS_UNIT_ID = 'f3b57ce7-0796-40e5-94f1-07cb2b48ba85';

type GraphPage<T> = { data?: T[]; paging?: { next?: string }; error?: { message?: string } };

async function graphJson<T>(url: string, token: string): Promise<GraphPage<T>> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`instagram_backfill_graph_${response.status}:${body?.error?.message || 'unknown'}`);
  return body as GraphPage<T>;
}

async function resolvePageAccessToken(storedToken: string, pageId: string) {
  const version = process.env.META_GRAPH_VERSION || 'v26.0';
  try {
    const body = await graphJson<any>(
      `https://graph.facebook.com/${version}/me/accounts?fields=id,access_token&limit=25`,
      storedToken,
    );
    const page = (body.data || []).find((item: any) => String(item?.id || '') === pageId);
    if (page?.access_token) return String(page.access_token);
  } catch {}

  const pageProbe = await graphJson<any>(
    `https://graph.facebook.com/${version}/${encodeURIComponent(pageId)}?fields=id`,
    storedToken,
  ) as any;
  if (String(pageProbe?.id || '') === pageId) return storedToken;
  throw new Error('instagram_backfill_page_token_not_found');
}

function normalizeHistoryMessage(message: any, businessInstagramId: string, pageId: string): NormalizedMessage | null {
  const fromId = String(message?.from?.id || '');
  const toIds = Array.isArray(message?.to?.data) ? message.to.data.map((item: any) => String(item?.id || '')).filter(Boolean) : [];
  const outbound = fromId === businessInstagramId || fromId === pageId;
  const counterparty = outbound ? toIds.find((id: string) => id !== businessInstagramId && id !== pageId) : fromId;
  const id = String(message?.id || '');
  if (!id || !counterparty) return null;

  return {
    channel: 'instagram',
    provider: 'meta',
    transport: 'instagram_api',
    provider_message_id: id,
    external_thread_id: counterparty,
    external_user_id: counterparty,
    direction: outbound ? 'outbound' : 'inbound',
    sender_type: outbound ? 'human' : 'customer',
    text: message?.message ? String(message.message) : null,
    message_type: 'text',
    sent_at: new Date(message?.created_time || Date.now()).toISOString(),
    raw_payload: { source: 'instagram_history_backfill', message },
    display_name: outbound ? null : (message?.from?.name ? String(message.from.name) : null),
  };
}

export async function backfillInstagramConversations(
  db: SupabaseClient,
  options: { limit?: number } = {},
) {
  const businessUnitId = process.env.MANITO_BUSINESS_UNIT_ID || DEFAULT_BUSINESS_UNIT_ID;
  let storedToken: string | null = null;

  try {
    const connection = await loadActiveMetaConnectionToken(db, businessUnitId);
    storedToken = connection?.token || null;
  } catch (error) {
    console.warn('instagram_backfill_meta_connection_unavailable', {
      reason: error instanceof Error ? error.message : 'unknown',
    });
  }

  if (!storedToken) {
    const { data: config, error } = await db
      .from('integraciones_secretas')
      .select('wa_access_token')
      .eq('id', 'global')
      .maybeSingle();
    if (error) throw error;
    storedToken = config?.wa_access_token ? String(config.wa_access_token) : null;
  }
  if (!storedToken) throw new Error('instagram_backfill_token_not_configured');

  const version = process.env.META_GRAPH_VERSION || 'v26.0';
  const pageId = process.env.META_PAGE_ID || DEFAULT_PAGE_ID;
  const businessInstagramId = process.env.META_INSTAGRAM_BUSINESS_ID || DEFAULT_IG_BUSINESS_ID;
  const pageToken = await resolvePageAccessToken(storedToken, pageId);
  const requestedLimit = Math.max(1, Math.min(Number(options.limit || 10), 10));

  const conversations = await graphJson<any>(
    `https://graph.facebook.com/${version}/${encodeURIComponent(pageId)}/conversations?platform=instagram&fields=id,updated_time&limit=${requestedLimit}`,
    pageToken,
  );

  let conversationsScanned = 0;
  let conversationsFailed = 0;
  let messagesStored = 0;
  let duplicates = 0;
  let ordersSynced = 0;

  for (const conversation of conversations.data || []) {
    const conversationId = String(conversation?.id || '');
    if (!conversationId) continue;
    conversationsScanned += 1;

    try {
      const detail = await graphJson<any>(
        `https://graph.facebook.com/${version}/${encodeURIComponent(conversationId)}?fields=messages.limit(25){id,created_time,from,to,message}`,
        pageToken,
      ) as any;
      const rows = Array.isArray(detail?.messages?.data) ? detail.messages.data : [];
      let localConversationId: string | null = null;

      for (const row of [...rows].reverse()) {
        const normalized = normalizeHistoryMessage(row, businessInstagramId, pageId);
        if (!normalized) continue;
        const persisted = await persistMessage(db, normalized);
        localConversationId = persisted.conversationId || localConversationId;
        persisted.duplicate ? (duplicates += 1) : (messagesStored += 1);
      }

      if (localConversationId) {
        const synced = await autoRegisterInstagramConversationSale(db, localConversationId);
        if (synced.status === 'synced') ordersSynced += 1;
      }
    } catch (error) {
      conversationsFailed += 1;
      console.warn('instagram_backfill_conversation_failed', {
        conversationId,
        reason: error instanceof Error ? error.message : 'unknown',
      });
    }
  }

  return { conversationsScanned, conversationsFailed, messagesStored, duplicates, ordersSynced };
}
