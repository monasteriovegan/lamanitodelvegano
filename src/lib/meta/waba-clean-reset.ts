export type GraphCorrelationHeaders = {
  facebookApiVersion: string | null;
  requestId: string | null;
  traceId: string | null;
};

export type CleanResetCall = {
  operation: string;
  version: string;
  method: 'DELETE' | 'GET' | 'POST';
  httpStatus: number | null;
  headers: GraphCorrelationHeaders;
  accepted: boolean | null;
  appIds: string[];
  error: string | null;
};

export type CleanResetResult = {
  status: 'subscribed' | 'not_subscribed' | 'reset_not_empty' | 'unknown';
  successfulVersion: string | null;
  calls: CleanResetCall[];
};

type CleanResetInput = {
  wabaId: string;
  appId: string;
  token: string;
  verifyToken: string;
  canonicalCallbackUri: string;
  fetchImpl?: typeof fetch;
};

function safeError(body: unknown): string | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const error = (body as Record<string, unknown>).error;
  if (!error || typeof error !== 'object' || Array.isArray(error)) return null;
  const record = error as Record<string, unknown>;
  const code = String(record.code ?? 'unknown').replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 40);
  const type = String(record.type ?? 'GraphError').replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 80);
  return `graph_error:${code || 'unknown'}:${type || 'GraphError'}`;
}

function extractAppIds(body: unknown): string[] {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return [];
  const data = (body as Record<string, unknown>).data;
  if (!Array.isArray(data)) return [];
  return data.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;
    const nested = record.whatsapp_business_api_data;
    const nestedRecord = nested && typeof nested === 'object' && !Array.isArray(nested)
      ? nested as Record<string, unknown>
      : null;
    const appId = String(nestedRecord?.id ?? record.id ?? '').trim();
    return appId ? [appId] : [];
  });
}

async function graphCall(input: {
  operation: string;
  version: string;
  method: 'DELETE' | 'GET' | 'POST';
  wabaId: string;
  token: string;
  body?: URLSearchParams;
  fetchImpl: typeof fetch;
}): Promise<CleanResetCall> {
  const url = new URL(
    `https://graph.facebook.com/${encodeURIComponent(input.version)}/${encodeURIComponent(input.wabaId)}/subscribed_apps`,
  );
  try {
    const headers = new Headers({ Authorization: `Bearer ${input.token}` });
    if (input.body) headers.set('content-type', 'application/x-www-form-urlencoded');
    const response = await input.fetchImpl(url, {
      method: input.method,
      headers,
      body: input.body,
      cache: 'no-store',
    });
    const body = await response.json().catch(() => null);
    const accepted = input.method === 'GET'
      ? null
      : response.ok && Boolean(
        body && typeof body === 'object' && !Array.isArray(body)
        && (body as Record<string, unknown>).success === true,
      );
    return {
      operation: input.operation,
      version: input.version,
      method: input.method,
      httpStatus: response.status,
      headers: {
        facebookApiVersion: response.headers.get('facebook-api-version'),
        requestId: response.headers.get('x-fb-request-id'),
        traceId: response.headers.get('x-fb-trace-id'),
      },
      accepted,
      appIds: input.method === 'GET' ? extractAppIds(body) : [],
      error: response.ok ? null : safeError(body) || 'graph_request_failed',
    };
  } catch {
    return {
      operation: input.operation,
      version: input.version,
      method: input.method,
      httpStatus: null,
      headers: { facebookApiVersion: null, requestId: null, traceId: null },
      accepted: input.method === 'GET' ? null : false,
      appIds: [],
      error: 'graph_request_failed',
    };
  }
}

export async function readWabaSubscriptionWithHeaders(input: {
  version: string;
  wabaId: string;
  token: string;
  fetchImpl?: typeof fetch;
}) {
  return graphCall({
    operation: `readback_${input.version}`,
    version: input.version,
    method: 'GET',
    wabaId: input.wabaId,
    token: input.token,
    fetchImpl: input.fetchImpl ?? fetch,
  });
}

export async function subscribeWabaOnce(input: {
  version: string;
  wabaId: string;
  appId: string;
  token: string;
  fetchImpl?: typeof fetch;
}) {
  const fetchImpl = input.fetchImpl ?? fetch;
  const mutation = await graphCall({
    operation: `post_single_${input.version}`,
    version: input.version,
    method: 'POST',
    wabaId: input.wabaId,
    token: input.token,
    fetchImpl,
  });
  const readback = await graphCall({
    operation: `get_after_single_${input.version}`,
    version: input.version,
    method: 'GET',
    wabaId: input.wabaId,
    token: input.token,
    fetchImpl,
  });
  return {
    status: readback.appIds.includes(input.appId) ? 'subscribed' as const : 'not_subscribed' as const,
    mutation,
    readback,
  };
}

export async function runCleanWabaSubscriptionReset(input: CleanResetInput): Promise<CleanResetResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const calls: CleanResetCall[] = [];
  const call = async (
    operation: string,
    version: string,
    method: 'DELETE' | 'GET' | 'POST',
    body?: URLSearchParams,
  ) => {
    const result = await graphCall({
      operation,
      version,
      method,
      wabaId: input.wabaId,
      token: input.token,
      body,
      fetchImpl,
    });
    calls.push(result);
    return result;
  };

  await call('delete_v26', 'v26.0', 'DELETE');
  const afterDelete = await call('get_after_delete_v26', 'v26.0', 'GET');
  if (afterDelete.error) return { status: 'unknown', successfulVersion: null, calls };
  if (afterDelete.appIds.length > 0) return { status: 'reset_not_empty', successfulVersion: null, calls };

  await call('post_clean_v26', 'v26.0', 'POST');
  const afterV26 = await call('get_after_post_v26', 'v26.0', 'GET');
  let successfulVersion: string | null = afterV26.appIds.includes(input.appId) ? 'v26.0' : null;

  if (!successfulVersion) {
    await call('post_clean_v24', 'v24.0', 'POST');
    const afterV24 = await call('get_after_post_v24', 'v24.0', 'GET');
    if (afterV24.appIds.includes(input.appId)) successfulVersion = 'v24.0';
  }

  if (!successfulVersion) return { status: 'not_subscribed', successfulVersion: null, calls };

  const callbackBody = new URLSearchParams({
    override_callback_uri: input.canonicalCallbackUri,
    verify_token: input.verifyToken,
  });
  await call(`post_callback_${successfulVersion}`, successfulVersion, 'POST', callbackBody);
  const afterCallback = await call(`get_after_callback_${successfulVersion}`, successfulVersion, 'GET');
  return {
    status: afterCallback.appIds.includes(input.appId) ? 'subscribed' : 'not_subscribed',
    successfulVersion,
    calls,
  };
}
