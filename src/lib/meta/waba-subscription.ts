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
      const nested = record.whatsapp_business_api_data;
      const nestedRecord = nested && typeof nested === 'object' && !Array.isArray(nested)
        ? nested as Record<string, unknown>
        : null;
      const appId = String(nestedRecord?.id || record.id || '').trim();
      if (!appId) return [];
      const rawFields = Array.isArray(record.subscribed_fields)
        ? record.subscribed_fields
        : nestedRecord?.subscribed_fields;
      return [{
        appId,
        fields: Array.isArray(rawFields)
          ? rawFields.map((field) => String(field)).filter(Boolean)
          : [],
      }];
    });
    return { httpStatus: response.status, apps, error: response.ok ? null : 'graph_request_failed' };
  } catch {
    return { httpStatus: null, apps: [], error: 'graph_request_failed' };
  }
}

export async function listWabaPhoneNumbers(input: {
  graphVersion: string;
  wabaId: string;
  token: string;
  fetchImpl?: typeof fetch;
}) {
  const url = new URL(
    `https://graph.facebook.com/${encodeURIComponent(input.graphVersion)}/${encodeURIComponent(input.wabaId)}/phone_numbers`,
  );
  url.searchParams.set('fields', 'id,display_phone_number,verified_name,quality_rating');
  try {
    const response = await (input.fetchImpl ?? fetch)(url, {
      headers: { Authorization: `Bearer ${input.token}` }, cache: 'no-store',
    });
    const body = await response.json().catch(() => null);
    const data = body && typeof body === 'object' && Array.isArray((body as Record<string, unknown>).data)
      ? (body as Record<string, unknown>).data as unknown[]
      : null;
    if (!data) return { httpStatus: response.status, phones: [], error: 'phone_assets_unavailable' };
    const phones = data.flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const record = item as Record<string, unknown>;
      const id = String(record.id || '').trim();
      if (!id) return [];
      return [{
        id,
        displayPhoneNumber: String(record.display_phone_number || '').trim() || null,
        verifiedName: String(record.verified_name || '').trim() || null,
        qualityRating: String(record.quality_rating || '').trim() || null,
      }];
    });
    return { httpStatus: response.status, phones, error: response.ok ? null : 'phone_assets_unavailable' };
  } catch {
    return { httpStatus: null, phones: [], error: 'phone_assets_unavailable' };
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
    if (!item || typeof item !== 'object') return false;
    const itemRecord = item as Record<string, unknown>;
    const nested = itemRecord.whatsapp_business_api_data;
    const nestedId = nested && typeof nested === 'object' && !Array.isArray(nested)
      ? String((nested as Record<string, unknown>).id ?? '')
      : '';
    return String(itemRecord.id ?? '') === appId || nestedId === appId;
  });
  if (!app || typeof app !== 'object') {
    return { status: 'not_subscribed', appId, fields: [], httpStatus: null, error: null };
  }

  const appRecord = app as Record<string, unknown>;
  const nested = appRecord.whatsapp_business_api_data;
  const nestedRecord = nested && typeof nested === 'object' && !Array.isArray(nested)
    ? nested as Record<string, unknown>
    : null;
  const rawFields = Array.isArray(appRecord.subscribed_fields)
    ? appRecord.subscribed_fields
    : nestedRecord?.subscribed_fields;
  const fields = Array.isArray(rawFields)
    ? rawFields.map((field) => String(field)).filter(Boolean)
    : [];

  return {
    // Meta's current subscribed_apps response identifies the subscribed app
    // under whatsapp_business_api_data and may omit subscribed_fields entirely.
    status: nestedRecord || fields.includes('messages') ? 'subscribed' : 'not_subscribed',
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
