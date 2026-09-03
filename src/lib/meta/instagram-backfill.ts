import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { persistMessage } from '@/lib/messaging/messages';
import type { NormalizedMessage } from '@/lib/messaging/types';
import { autoRegisterInstagramConversationSale } from '@/lib/orders/instagram-auto-sale';
import { MetaConnectionsRepository } from '@/lib/repositories/meta-connections-repository';

const DEFAULT_PAGE_ID = '1210803402107834';
const DEFAULT_BUSINESS_UNIT_ID = 'f3b57ce7-0796-40e5-94f1-07cb2b48ba85';
const FACEBOOK_GRAPH = 'https://graph.facebook.com';
const INSTAGRAM_GRAPH = 'https://graph.instagram.com';

// Instagram Login uses instagram_business_basic + instagram_business_manage_messages
// and the graph.instagram.com Conversations API. Facebook Login remains a fallback.
const INSTAGRAM_LOGIN_HISTORY_SCOPE = 'instagram_business_manage_messages';

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

type SyncResult = {
  localConversationId: string | null;
  messagesStored: number;
  duplicates: number;
  ordersSynced: number;
  usernames: string[];
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
      `${FACEBOOK_GRAPH}/${version}/me/accounts?fields=id,access_token&limit=25`,
      storedToken,
    );
    const page = (body.data || []).find((item: any) => String(item?.id || '') === pageId);
    if (page?.access_token) return String(page.access_token);
  } catch {}

  const response = await fetch(
    `${FACEBOOK_GRAPH}/${version}/${encodeURIComponent(pageId)}?fields=id`,
    { headers: { Authorization: `Bearer ${storedToken}` }, cache: 'no-store' },
  );
  const body = await response.json().catch(() => ({}));
  if (response.ok && String(body?.id || '') === pageId) return storedToken;
  throw new Error('instagram_backfill_page_token_not_found');
}

function usernameFromHistory(message: any) {
  const username = String(message?.from?.username || '').trim().replace(/^@/, '');
  return username ? `@${username}` : null;
}

function normalizeHistoryMessage(
  message: any,
  routingBusinessInstagramId: string,
  pageId: string,
  actorInstagramId = routingBusinessInstagramId,
): NormalizedMessage | null {
  const fromId = String(message?.from?.id || '');
  const toIds = Array.isArray(message?.to?.data)
    ? message.to.data.map((item: any) => String(item?.id || '')).filter(Boolean)
    : [];
  const businessIds = new Set(
    [routingBusinessInstagramId, actorInstagramId, pageId].map((id) => String(id || '')).filter(Boolean),
  );
  const outbound = businessIds.has(fromId);
  const counterparty = outbound
    ? toIds.find((id: string) => !businessIds.has(id))
    : fromId;
  const id = String(message?.id || '');
  if (!id || !counterparty) return null;

  const username = usernameFromHistory(message);
  const displayName = outbound
    ? null
    : username || (message?.from?.name ? String(message.from.name) : null);

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
    raw_payload: {
      source: 'instagram_history_backfill',
      business_instagram_id: routingBusinessInstagramId,
      message,
    },
    display_name: displayName,
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
  return `${FACEBOOK_GRAPH}/${source.version}/${encodeURIComponent(source.targetId)}/conversations?platform=instagram&fields=id&limit=1${cursor}`;
}

function targetedConversationUrls(source: ConversationSource, userId: string) {
  const base = `${FACEBOOK_GRAPH}/${source.version}/${encodeURIComponent(source.targetId)}/conversations`;
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

function instagramLoginConversationUrl(version: string, igUserId: string, after?: string | null) {
  const cursor = after ? `&after=${encodeURIComponent(after)}` : '';
  return `${INSTAGRAM_GRAPH}/${version}/${encodeURIComponent(igUserId)}/conversations?platform=instagram&fields=id,updated_time&limit=1${cursor}`;
}

async function findInstagramLoginConversation(input: {
  version: string;
  igUserId: string;
  accessToken: string;
  userId: string;
}) {
  const url = `${INSTAGRAM_GRAPH}/${input.version}/${encodeURIComponent(input.igUserId)}/conversations?user_id=${encodeURIComponent(input.userId)}&fields=id,updated_time&limit=1`;
  const page = await graphJson<GraphPage<any>>(url, input.accessToken, 1);
  return page.data?.[0] || null;
}

async function listInstagramLoginConversations(input: {
  version: string;
  igUserId: string;
  accessToken: string;
  limit: number;
}) {
  const conversations: any[] = [];
  let page = await graphJson<GraphPage<any>>(
    instagramLoginConversationUrl(input.version, input.igUserId),
    input.accessToken,
  );

  while (conversations.length < input.limit) {
    const row = page.data?.[0];
    if (row?.id) conversations.push(row);
    const after = nextCursor(page);
    if (!after || !row || conversations.length >= input.limit) break;
    page = await graphJson<GraphPage<any>>(
      instagramLoginConversationUrl(input.version, input.igUserId, after),
      input.accessToken,
    );
  }

  return conversations;
}

async function loadConversationMessages(input: {
  version: string;
  conversationId: string;
  accessToken: string;
  graphBase: string;
}) {
  const detail = await graphJson<any>(
    `${input.graphBase}/${input.version}/${encodeURIComponent(input.conversationId)}?fields=messages.limit(20){id,created_time}`,
    input.accessToken,
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
          `${input.graphBase}/${input.version}/${encodeURIComponent(messageId)}?fields=id,created_time,from,to,message`,
          input.accessToken,
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
  accessToken: string;
  graphBase: string;
  routingBusinessInstagramId: string;
  actorInstagramId: string;
  pageId: string;
}): Promise<SyncResult> {
  const rows = await loadConversationMessages({
    version: input.graphVersion,
    conversationId: input.conversationId,
    accessToken: input.accessToken,
    graphBase: input.graphBase,
  });
  let localConversationId: string | null = null;
  let messagesStored = 0;
  let duplicates = 0;
  const usernames = new Set<string>();

  for (const row of rows) {
    const username = usernameFromHistory(row);
    if (username && String(row?.from?.id || '') !== input.actorInstagramId) usernames.add(username);

    const normalized = normalizeHistoryMessage(
      row,
      input.routingBusinessInstagramId,
      input.pageId,
      input.actorInstagramId,
    );
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

  return {
    localConversationId,
    messagesStored,
    duplicates,
    ordersSynced,
    usernames: Array.from(usernames),
  };
}

async function runInstagramLoginBackfill(input: {
  db: SupabaseClient;
  version: string;
  accessToken: string;
  igUserId: string;
  routingBusinessInstagramId: string;
  pageId: string;
  limit: number;
  userId?: string;
}) {
  if (input.userId) {
    const conversation = await findInstagramLoginConversation({
      version: input.version,
      igUserId: input.igUserId,
      accessToken: input.accessToken,
      userId: input.userId,
    });
    if (!conversation?.id) {
      return {
        conversationsScanned: 0,
        conversationsFailed: 0,
        messagesStored: 0,
        duplicates: 0,
        ordersSynced: 0,
        source: 'instagram_login',
        graphVersion: input.version,
        targeted: true,
        found: false,
        usernames: [] as string[],
      };
    }

    const synced = await syncConversation({
      db: input.db,
      conversationId: String(conversation.id),
      graphVersion: input.version,
      accessToken: input.accessToken,
      graphBase: INSTAGRAM_GRAPH,
      routingBusinessInstagramId: input.routingBusinessInstagramId,
      actorInstagramId: input.igUserId,
      pageId: input.pageId,
    });
    return {
      conversationsScanned: 1,
      conversationsFailed: 0,
      messagesStored: synced.messagesStored,
      duplicates: synced.duplicates,
      ordersSynced: synced.ordersSynced,
      source: 'instagram_login',
      graphVersion: input.version,
      targeted: true,
      found: true,
      localConversationId: synced.localConversationId,
      usernames: synced.usernames,
    };
  }

  const conversations = await listInstagramLoginConversations({
    version: input.version,
    igUserId: input.igUserId,
    accessToken: input.accessToken,
    limit: input.limit,
  });
  let conversationsScanned = 0;
  let conversationsFailed = 0;
  let messagesStored = 0;
  let duplicates = 0;
  let ordersSynced = 0;
  const usernames = new Set<string>();

  for (const conversation of conversations) {
    const conversationId = String(conversation?.id || '');
    if (!conversationId) continue;
    conversationsScanned += 1;
    try {
      const synced = await syncConversation({
        db: input.db,
        conversationId,
        graphVersion: input.version,
        accessToken: input.accessToken,
        graphBase: INSTAGRAM_GRAPH,
        routingBusinessInstagramId: input.routingBusinessInstagramId,
        actorInstagramId: input.igUserId,
        pageId: input.pageId,
      });
      messagesStored += synced.messagesStored;
      duplicates += synced.duplicates;
      ordersSynced += synced.ordersSynced;
      synced.usernames.forEach((username) => usernames.add(username));
    } catch (error) {
      conversationsFailed += 1;
      console.warn('instagram_login_backfill_conversation_failed', {
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
    source: 'instagram_login',
    graphVersion: input.version,
    targeted: false,
    usernames: Array.from(usernames),
  };
}

export async function backfillInstagramConversations(
  db: SupabaseClient,
  options: { limit?: number; businessUnitId?: string; userId?: string } = {},
) {
  const businessUnitId = options.businessUnitId || process.env.MANITO_BUSINESS_UNIT_ID || DEFAULT_BUSINESS_UNIT_ID;
  const repository = new MetaConnectionsRepository(db);
  const routingCredential = await repository.getActiveCredential(
    businessUnitId,
    'instagram_account',
  );
  const storedToken = routingCredential.accessToken;
  const routingBusinessInstagramId = routingCredential.externalId;
  const businessInstagramId = routingBusinessInstagramId;
  const pageId = String(routingCredential.metadata?.page_id || process.env.META_PAGE_ID || DEFAULT_PAGE_ID);
  if (!pageId) throw new Error('instagram_backfill_page_id_not_configured');
  if (options.userId && !/^\d+$/.test(options.userId)) throw new Error('instagram_backfill_invalid_user_id');

  const version = process.env.META_GRAPH_VERSION || 'v26.0';
  const requestedLimit = Math.max(1, Math.min(Number(options.limit || 3), 10));

  try {
    const instagramLogin = await repository.getInstagramLoginCredential(businessUnitId);
    return await runInstagramLoginBackfill({
      db,
      version,
      accessToken: instagramLogin.accessToken,
      igUserId: instagramLogin.externalId,
      routingBusinessInstagramId,
      pageId,
      limit: requestedLimit,
      ...(options.userId ? { userId: options.userId } : {}),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown';
    if (reason !== 'instagram_login_not_connected' && reason !== 'instagram_login_reauthorization_required') {
      console.warn('instagram_login_backfill_fallback', {
        scope: INSTAGRAM_LOGIN_HISTORY_SCOPE,
        reason,
      });
    }
  }

  const pageToken = await resolvePageAccessToken(storedToken, pageId);

  if (options.userId) {
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
        usernames: [] as string[],
      };
    }

    const synced = await syncConversation({
      db,
      conversationId: String(targeted.conversation.id),
      graphVersion: targeted.source.version,
      accessToken: pageToken,
      graphBase: FACEBOOK_GRAPH,
      routingBusinessInstagramId,
      actorInstagramId: businessInstagramId,
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
      usernames: synced.usernames,
    };
  }

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
  const usernames = new Set<string>();

  for (const conversation of recent.conversations) {
    const conversationId = String(conversation?.id || '');
    if (!conversationId) continue;
    conversationsScanned += 1;

    try {
      const synced = await syncConversation({
        db,
        conversationId,
        graphVersion: recent.source.version,
        accessToken: pageToken,
        graphBase: FACEBOOK_GRAPH,
        routingBusinessInstagramId,
        actorInstagramId: businessInstagramId,
        pageId,
      });
      messagesStored += synced.messagesStored;
      duplicates += synced.duplicates;
      ordersSynced += synced.ordersSynced;
      synced.usernames.forEach((username) => usernames.add(username));
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
    usernames: Array.from(usernames),
  };
}
