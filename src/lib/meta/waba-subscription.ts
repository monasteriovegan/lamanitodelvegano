export type WabaSubscriptionState = {
  status: 'subscribed' | 'not_subscribed' | 'unknown';
  appId: string;
  fields: string[];
  httpStatus: number | null;
  error: string | null;
};

type EnsureWabaMessagesSubscriptionInput = {
  graphVersion: string;
  wabaId: string;
  appId: string;
  token: string;
  fetchImpl?: typeof fetch;
};

type EnsureWabaMessagesSubscriptionResult = {
  before: WabaSubscriptionState;
  mutationStatus: number | null;
  mutationAccepted: boolean | null;
  after: WabaSubscriptionState;
};

export async function listWabaSubscriptions(input: {
  graphVersion: string;
  wabaId: string;
  token: string;
  fetchImpl?: typeof fetch;
}) {
  const url = new URL(
    `https://graph.facebook.com/${encodeURIComponent(input.graphVersion)}/${encodeURIComponent(input.wabaId)}/subscribed_apps`,
  );
  try {
    const response = await (input.fetchImpl ?? fetch)(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${input.token}` },
      cache: 'no-store',
    });
    const body = await response.json().catch(() => null);
    if (!body || typeof body !== 'object' || !Array.isArray((body as Record<string, unknown>).data)) {
      const error = body && typeof body === 'object'
        ? graphErrorCode(body as Record<string, unknown>)
        : null;
      return { httpStatus: response.status, apps: [], error: error || 'malformed_graph_response' };
    }
    const apps = ((body as Record<string, unknown>).data as unknown[]).flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const record = item as Record<string, unknown>;
      const appId = String(record.id || '').trim();
      if (!appId) return [];
      return [{
        appId,
        fields: Array.isArray(record.subscribed_fields)
          ? record.subscribed_fields.map((field) => String(field)).filter(Boolean)
          : [],
      }];
    });
    return { httpStatus: response.status, apps, error: response.ok ? null : 'graph_request_failed' };
  } catch {
    return { httpStatus: null, apps: [], error: 'graph_request_failed' };
  }
}

function unknownState(appId: string, error: string, httpStatus: number | null = null): WabaSubscriptionState {
  return { status: 'unknown', appId, fields: [], httpStatus, error };
}

function graphErrorCode(body: Record<string, unknown>) {
  const graphError = body.error;
  if (!graphError || typeof graphError !== 'object') return null;
  const code = String((graphError as Record<string, unknown>).code ?? 'unknown');
  const type = String((graphError as Record<string, unknown>).type ?? 'GraphError')
    .replace(/[^a-zA-Z0-9_.-]/g, '')
    .slice(0, 80);
  return `graph_error:${code}:${type || 'GraphError'}`;
}

export function parseWabaSubscription(body: unknown, appId: string): WabaSubscriptionState {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return unknownState(appId, 'malformed_graph_response');
  }

  const record = body as Record<string, unknown>;
  const error = graphErrorCode(record);
  if (error) return unknownState(appId, error);
  if (!Array.isArray(record.data)) return unknownState(appId, 'malformed_graph_response');

  const app = record.data.find((item) => {
    return Boolean(item && typeof item === 'object' && String((item as Record<string, unknown>).id ?? '') === appId);
  });
  if (!app || typeof app !== 'object') {
    return { status: 'not_subscribed', appId, fields: [], httpStatus: null, error: null };
  }

  const rawFields = (app as Record<string, unknown>).subscribed_fields;
  const fields = Array.isArray(rawFields)
    ? rawFields.map((field) => String(field)).filter(Boolean)
    : [];

  return {
    status: fields.includes('messages') ? 'subscribed' : 'not_subscribed',
    appId,
    fields,
    httpStatus: null,
    error: null,
  };
}

async function readSubscription(
  url: URL,
  appId: string,
  token: string,
  fetchImpl: typeof fetch,
): Promise<WabaSubscriptionState> {
  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    const body = await response.json().catch(() => null);
    return { ...parseWabaSubscription(body, appId), httpStatus: response.status };
  } catch {
    return unknownState(appId, 'graph_request_failed');
  }
}

export async function ensureWabaMessagesSubscription(
  input: EnsureWabaMessagesSubscriptionInput,
): Promise<EnsureWabaMessagesSubscriptionResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const url = new URL(
    `https://graph.facebook.com/${encodeURIComponent(input.graphVersion)}/${encodeURIComponent(input.wabaId)}/subscribed_apps`,
  );
  const before = await readSubscription(url, input.appId, input.token, fetchImpl);

  if (before.status === 'subscribed' && before.fields.includes('messages')) {
    return { before, mutationStatus: null, mutationAccepted: null, after: before };
  }

  let mutationStatus: number | null = null;
  let mutationAccepted = false;
  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${input.token}` },
      cache: 'no-store',
    });
    mutationStatus = response.status;
    const mutationBody = await response.json().catch(() => null);
    mutationAccepted = response.ok
      && Boolean(mutationBody && typeof mutationBody === 'object' && (mutationBody as Record<string, unknown>).success === true);
  } catch {
    mutationStatus = null;
  }

  const after = await readSubscription(url, input.appId, input.token, fetchImpl);
  return { before, mutationStatus, mutationAccepted, after };
}
