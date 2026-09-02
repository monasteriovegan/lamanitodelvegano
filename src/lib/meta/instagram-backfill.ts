import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { persistMessage } from '@/lib/messaging/messages';
import type { NormalizedMessage } from '@/lib/messaging/types';
import { autoRegisterInstagramConversationSale } from '@/lib/orders/instagram-auto-sale';
import { MetaConnectionsRepository } from '@/lib/repositories/meta-connections-repository';

const DEFAULT_PAGE_ID = '1210803402107834';
const DEFAULT_BUSINESS_UNIT_ID = 'f3b57ce7-0796-40e5-94f1-07cb2b48ba85';

type GraphPage<T> = {
  data?: T[];
  paging?: {
    next?: string;
    cursors?: { after?: string };
  };
  error?: { message?: string };
};

type ConversationSource = {
  version: string;
  targetId: string;
  kind: 'page' | 'me' | 'instagram_business';
};

function isRetryableGraphError(status: number, message: string) {
  return status >= 500 || (status === 400 && /timeout|temporar/i.test(message));
}

async function waitForRetry(attempt: number) {
  await new Promise((resolve) => setTimeout(resolve, 250 * (2 ** attempt)));
}

async function graphJson<T>(url: string, token: string, attempts = 3): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const body = await response.json().catch(() => ({}));
      if (response.ok) return body as T;

      const message = String(body?.error?.message || 'unknown');
      lastError = new Error(`instagram_backfill_graph_${response.status}:${message}`);
      if (!isRetryableGraphError(response.status, message) || attempt === attempts - 1) {
        throw lastError;
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('instagram_backfill_graph_')) {
        if (attempt === attempts - 1 || !/Timeout|temporar/i.test(error.message)) throw error;
        lastError = error;
      } else {
        lastError = error instanceof Error ? error : new Error('instagram_backfill_graph_network_error');
        if (attempt === attempts - 1) throw lastError;
      }
    }

    await waitForRetry(attempt);
  }

  throw lastError || new Error('instagram_backfill_graph_unknown_error');
}

async function resolvePageAccessToken(storedToken: string, pageId: string) {
  const version = process.env.META_GRAPH_VERSION || 'v26.0';
  try {
    const body = await graphJson<GraphPage<any>>(
      `https://graph.facebook.com/${version}/me/accounts?fields=id,access_token&limit=25`,
      storedToken,
    );
    const page = (body.data || []).find((item: any) => String(item?.id || '') === pageId);
    if (page?.access_token) return String(page.access_token);
  } catch {}

  const response = await fetch(
    `https://graph.facebook.com/${version}/${encodeURIComponent(pageId)}?fields=id`,
    { headers: { Authorization: `Bearer ${storedToken}` }, cache: 'no-store' },
  );
  const body = await response.json().catch(() => ({}));
  if (response.ok && String(body?.id || '') === pageId) return storedToken;
  throw new Error('instagram_backfill_page_token_not_found');
}

function normalizeHistoryMessage(message: any, businessInstagramId: string, pageId: string): NormalizedMessage | null {
  const fromId = String(message?.from?.id || '');
  const toIds = Array.isArray(message?.to?.data)
    ? message.to.data.map((item: any) => String(item?.id || '')).filter(Boolean)
    : [];
  const outbound = fromId === businessInstagramId || fromId === pageId;
  const counterparty = outbound
    ? toIds.find((id: string) => id !== businessInstagramId && id !== pageId)
    : fromId;
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

function nextCursor(page: GraphPage<any>) {
  const direct = page.paging?.cursors?.after;
  if (direct) return direct;
  const next = page.paging?.next;
  if (!next) return null;
  try {
    return new URL(next).searchParams.get('after');
  } catch {
    return null;
  }
}

function conversationUrl(source: ConversationSource, after?: string | null) {
  const cursor = after ? `&after=${encodeURIComponent(after)}` : '';
  return `https://graph.facebook.com/${source.version}/${encodeURIComponent(source.targetId)}/conversations?platform=instagram&fields=id&limit=1${cursor}`;
}

function targetedConversationUrls(source: ConversationSource, userId: string) {
  const base = `https://graph.facebook.com/${source.version}/${encodeURIComponent(source.targetId)}/conversations`;
  const encodedUser = encodeURIComponent(userId);
  return [
    `${base}?user_id=${encodedUser}&fields=id,updated_time&limit=1`,
    `${base}?platform=instagram&user_id=${encodedUser}&fields=id,updated_time&limit=1`,
  ];
}

function conversationCandidates(input: {
  version: string;
  pageId: string;
  businessInstagramId: string;
}) {
  const versions = Array.from(new Set([input.version, 'v25.0', 'v24.0']));
  return versions.flatMap((version) => [
    { version, targetId: input.pageId, kind: 'page' as const },
    { version, targetId: 'me', kind: 'me' as const },
    { version, targetId: input.businessInstagramId, kind: 'instagram_business' as const },
  ]);
}

async function discoverConversationSource(input: {
  version: string;
  pageId: string;
  businessInstagramId: string;
  pageToken: string;
}) {
  const candidates = conversationCandidates(input);
  let emptyResult: { source: ConversationSource; page: GraphPage<any> } | null = null;
  let lastError: Error | null = null;

  for (const source of candidates) {
    try {
      const page = await graphJson<GraphPage<any>>(conversationUrl(source), input.pageToken, 1);
      if (Array.isArray(page.data) && page.data.length > 0) return { source, page };
      if (!emptyResult) emptyResult = { source, page };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('instagram_backfill_source_failed');
      console.warn('instagram_backfill_source_failed', {
        source: source.kind,
        version: source.version,
        reason: lastError.message,
      });
    }
  }

  if (emptyResult) return emptyResult;
  throw lastError || new Error('instagram_backfill_no_conversation_source');
}

async function findTargetedConversation(input: {
  version: string;
  pageId: string;
  businessInstagramId: string;
  pageToken: string;
  userId: string;
}) {
  const candidates = conversationCandidates(input);
  let lastError: Error | null = null;

  for (const source of candidates) {
    for (const url of targetedConversationUrls(source, input.userId)) {
      try {
        const page = await graphJson<GraphPage<any>>(url, input.pageToken, 1);
        const row = page.data?.[0];
        if (row?.id) return { source, conversation: row };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('instagram_targeted_backfill_failed');
        console.warn('instagram_targeted_source_failed', {
          source: source.kind,
          version: source.version,
          reason: lastError.message,
        });
      }
    }
  }

  if (lastError) throw lastError;
  return null;
}

async function listRecentConversations(input: {
  version: string;
  pageId: string;
  businessInstagramId: string;
  pageToken: string;
  limit: number;
}) {
  const discovered = await discoverConversationSource(input);
  const conversations: any[] = [];
  let page = discovered.page;

  while (conversations.length < input.limit) {
    const row = page.data?.[0];
    if (row?.id) conversations.push(row);
    const after = nextCursor(page);
    if (!after || !row || conversations.length >= input.limit) break;
    page = await graphJson<GraphPage<any>>(
      conversationUrl(discovered.source, after),
      input.pageToken,
    );
  }

  return { conversations, source: discovered.source };
}

async function loadConversationMessages(input: {
  version: string;
  conversationId: string;
  pageToken: string;
}) {
  const detail = await graphJson<any>(
    `https://graph.facebook.com/${input.version}/${encodeURIComponent(input.conversationId)}?fields=messages.limit(20){id,created_time}`,
    input.pageToken,
  );
  const refs = Array.isArray(detail?.messages?.data) ? detail.messages.data.slice(0, 20) : [];
  const messages: any[] = [];

  for (let index = 0; index < refs.length; index += 5) {
    const batch = refs.slice(index, index + 5);
    const rows = await Promise.all(batch.map(async (ref: any) => {
      const messageId = String(ref?.id || '');
      if (!messageId) return null;
      try {
        return await graphJson<any>(
          `https://graph.facebook.com/${input.version}/${encodeURIComponent(messageId)}?fields=id,created_time,from,to,message`,
          input.pageToken,
        );
      } catch (error) {
        console.warn('instagram_backfill_message_failed', {
          messageId,
          reason: error instanceof Error ? error.message : 'unknown',
        });
        return null;
      }
    }));
    messages.push(...rows.filter(Boolean));
  }

  return messages.sort((a, b) => {
    const left = new Date(a?.created_time || 0).getTime();
    const right = new Date(b?.created_time || 0).getTime();
    return left - right;
  });
}

async function syncConversation(input: {
  db: SupabaseClient;
  conversationId: string;
  graphVersion: string;
  pageToken: string;
  businessInstagramId: string;
  pageId: string;
}) {
  const rows = await loadConversationMessages({
    version: input.graphVersion,
    conversationId: input.conversationId,
    pageToken: input.pageToken,
  });
  let localConversationId: string | null = null;
  let messagesStored = 0;
  let duplicates = 0;

  for (const row of rows) {
    const normalized = normalizeHistoryMessage(row, input.businessInstagramId, input.pageId);
    if (!normalized) continue;
    const persisted = await persistMessage(input.db, normalized);
    localConversationId = persisted.conversationId || localConversationId;
    persisted.duplicate ? (duplicates += 1) : (messagesStored += 1);
  }

  let ordersSynced = 0;
  if (localConversationId) {
    const synced = await autoRegisterInstagramConversationSale(input.db, localConversationId);
    if (synced.status === 'synced') ordersSynced = 1;
  }

  return { localConversationId, messagesStored, duplicates, ordersSynced };
}

export async function backfillInstagramConversations(
  db: SupabaseClient,
  options: { limit?: number; businessUnitId?: string; userId?: string } = {},
) {
  const businessUnitId = options.businessUnitId || process.env.MANITO_BUSINESS_UNIT_ID || DEFAULT_BUSINESS_UNIT_ID;
  const credential = await new MetaConnectionsRepository(db).getActiveCredential(
    businessUnitId,
    'instagram_account',
  );
  const storedToken = credential.accessToken;
  const businessInstagramId = credential.externalId;
  const pageId = String(credential.metadata?.page_id || process.env.META_PAGE_ID || DEFAULT_PAGE_ID);
  if (!pageId) throw new Error('instagram_backfill_page_id_not_configured');

  const version = process.env.META_GRAPH_VERSION || 'v26.0';
  const pageToken = await resolvePageAccessToken(storedToken, pageId);

  if (options.userId) {
    if (!/^\d+$/.test(options.userId)) throw new Error('instagram_backfill_invalid_user_id');
    const targeted = await findTargetedConversation({
      version,
      pageId,
      businessInstagramId,
      pageToken,
      userId: options.userId,
    });
    if (!targeted) {
      return {
        conversationsScanned: 0,
        conversationsFailed: 0,
        messagesStored: 0,
        duplicates: 0,
        ordersSynced: 0,
        source: 'targeted',
        graphVersion: version,
        targeted: true,
        found: false,
      };
    }

    const synced = await syncConversation({
      db,
      conversationId: String(targeted.conversation.id),
      graphVersion: targeted.source.version,
      pageToken,
      businessInstagramId,
      pageId,
    });
    return {
      conversationsScanned: 1,
      conversationsFailed: 0,
      messagesStored: synced.messagesStored,
      duplicates: synced.duplicates,
      ordersSynced: synced.ordersSynced,
      source: targeted.source.kind,
      graphVersion: targeted.source.version,
      targeted: true,
      found: true,
      localConversationId: synced.localConversationId,
    };
  }

  const requestedLimit = Math.max(1, Math.min(Number(options.limit || 3), 10));
  const recent = await listRecentConversations({
    version,
    pageId,
    businessInstagramId,
    pageToken,
    limit: requestedLimit,
  });

  let conversationsScanned = 0;
  let conversationsFailed = 0;
  let messagesStored = 0;
  let duplicates = 0;
  let ordersSynced = 0;

  for (const conversation of recent.conversations) {
    const conversationId = String(conversation?.id || '');
    if (!conversationId) continue;
    conversationsScanned += 1;

    try {
      const synced = await syncConversation({
        db,
        conversationId,
        graphVersion: recent.source.version,
        pageToken,
        businessInstagramId,
        pageId,
      });
      messagesStored += synced.messagesStored;
      duplicates += synced.duplicates;
      ordersSynced += synced.ordersSynced;
    } catch (error) {
      conversationsFailed += 1;
      console.warn('instagram_backfill_conversation_failed', {
        conversationId,
        reason: error instanceof Error ? error.message : 'unknown',
      });
    }
  }

  return {
    conversationsScanned,
    conversationsFailed,
    messagesStored,
    duplicates,
    ordersSynced,
    source: recent.source.kind,
    graphVersion: recent.source.version,
    targeted: false,
  };
}
