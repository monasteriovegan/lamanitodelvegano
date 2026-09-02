import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { configureInstagramAppCallback } from '@/lib/meta/setup-messaging';
import { MetaConnectionsRepository } from '@/lib/repositories/meta-connections-repository';

const DEFAULT_APP_ID = '1691394752113175';
const DEFAULT_PAGE_ID = '1210803402107834';
const DEFAULT_BUSINESS_UNIT_ID = 'f3b57ce7-0796-40e5-94f1-07cb2b48ba85';

type GraphResult = {
  response: Response;
  body: any;
};

type TokenAttempt = {
  source: 'tenant' | 'legacy';
  resolved: boolean;
  mutationStatus: number | null;
  inspectStatus: number | null;
  primaryAppSubscribed: boolean;
  fields: string[];
  error?: string;
};

async function graphJson(url: URL, token: string, init: RequestInit = {}): Promise<GraphResult> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
    cache: 'no-store',
  });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

function graphMessage(body: any, fallback: string) {
  return String(body?.error?.message || body?.message || fallback);
}

async function resolvePageAccessToken(token: string, pageId: string, version: string) {
  const accountsUrl = new URL(`https://graph.facebook.com/${version}/me/accounts`);
  accountsUrl.searchParams.set('fields', 'id,access_token');
  accountsUrl.searchParams.set('limit', '100');
  const accounts = await graphJson(accountsUrl, token);
  if (accounts.response.ok) {
    const page = (accounts.body?.data || []).find((item: any) => String(item?.id || '') === pageId);
    if (page?.access_token) return String(page.access_token);
  }

  const pageUrl = new URL(`https://graph.facebook.com/${version}/${encodeURIComponent(pageId)}`);
  pageUrl.searchParams.set('fields', 'id');
  const direct = await graphJson(pageUrl, token);
  if (direct.response.ok && String(direct.body?.id || '') === pageId) return token;
  return null;
}

async function subscribeAndVerify(input: {
  token: string;
  source: TokenAttempt['source'];
  pageId: string;
  appId: string;
  version: string;
}): Promise<TokenAttempt> {
  const pageToken = await resolvePageAccessToken(input.token, input.pageId, input.version);
  if (!pageToken) {
    return {
      source: input.source,
      resolved: false,
      mutationStatus: null,
      inspectStatus: null,
      primaryAppSubscribed: false,
      fields: [],
      error: 'page_token_not_resolved',
    };
  }

  const subscribeUrl = new URL(`https://graph.facebook.com/${input.version}/${encodeURIComponent(input.pageId)}/subscribed_apps`);
  subscribeUrl.searchParams.set('subscribed_fields', 'messages,messaging_postbacks');
  const mutation = await graphJson(subscribeUrl, pageToken, { method: 'POST' });

  const inspectUrl = new URL(`https://graph.facebook.com/${input.version}/${encodeURIComponent(input.pageId)}/subscribed_apps`);
  inspectUrl.searchParams.set('fields', 'id,name,subscribed_fields');
  const inspection = await graphJson(inspectUrl, pageToken);
  const app = inspection.response.ok
    ? (inspection.body?.data || []).find((item: any) => String(item?.id || '') === input.appId)
    : null;
  const fields = Array.isArray(app?.subscribed_fields)
    ? app.subscribed_fields.map((field: unknown) => String(field))
    : [];
  const primaryAppSubscribed = Boolean(app)
    && fields.includes('messages')
    && fields.includes('messaging_postbacks');

  return {
    source: input.source,
    resolved: true,
    mutationStatus: mutation.response.status,
    inspectStatus: inspection.response.status,
    primaryAppSubscribed,
    fields,
    ...(!primaryAppSubscribed
      ? { error: graphMessage(inspection.body, graphMessage(mutation.body, 'primary_app_not_subscribed')) }
      : {}),
  };
}

export async function rewireInstagramWebhook(
  db: SupabaseClient,
  input: {
    verifyToken: string;
    legacyPageToken?: string | null;
    businessUnitId?: string;
  },
) {
  const appId = process.env.META_APP_ID || DEFAULT_APP_ID;
  const businessUnitId = input.businessUnitId || process.env.MANITO_BUSINESS_UNIT_ID || DEFAULT_BUSINESS_UNIT_ID;
  const credential = await new MetaConnectionsRepository(db).getActiveCredential(
    businessUnitId,
    'instagram_account',
  );
  const pageId = String(credential.metadata?.page_id || process.env.META_PAGE_ID || DEFAULT_PAGE_ID);
  const versions = Array.from(new Set([
    process.env.META_GRAPH_VERSION || 'v26.0',
    'v25.0',
    'v24.0',
  ]));

  let callback: Awaited<ReturnType<typeof configureInstagramAppCallback>> | null = null;
  let callbackVersion: string | null = null;
  for (const version of versions) {
    callback = await configureInstagramAppCallback(version, input.verifyToken);
    if (callback.ok) {
      callbackVersion = version;
      break;
    }
  }

  const tokenCandidates = [
    { source: 'tenant' as const, token: credential.accessToken },
    ...(input.legacyPageToken && input.legacyPageToken !== credential.accessToken
      ? [{ source: 'legacy' as const, token: input.legacyPageToken }]
      : []),
  ];

  const attempts: TokenAttempt[] = [];
  let subscribedVersion: string | null = null;
  for (const version of versions) {
    for (const candidate of tokenCandidates) {
      const attempt = await subscribeAndVerify({
        token: candidate.token,
        source: candidate.source,
        pageId,
        appId,
        version,
      });
      attempts.push(attempt);
      if (attempt.primaryAppSubscribed) {
        subscribedVersion = version;
        break;
      }
    }
    if (subscribedVersion) break;
  }

  const primaryAppSubscribed = attempts.some((attempt) => attempt.primaryAppSubscribed);
  return {
    ok: Boolean(callback?.ok) && primaryAppSubscribed,
    appId,
    pageId,
    callback: callback
      ? {
          ok: callback.ok,
          status: callback.status,
          callbackUrl: callback.callbackUrl || null,
          error: callback.error || null,
        }
      : null,
    callbackVersion,
    primaryAppSubscribed,
    subscribedVersion,
    attempts,
  };
}
