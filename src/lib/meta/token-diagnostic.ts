export async function diagnoseMetaToken(input: {
  graphVersion: string;
  token: string;
  appId: string;
  appSecret: string;
  fetchImpl?: typeof fetch;
}) {
  const url = new URL(`https://graph.facebook.com/${encodeURIComponent(input.graphVersion)}/debug_token`);
  url.searchParams.set('input_token', input.token);
  url.searchParams.set('access_token', `${input.appId}|${input.appSecret}`);
  try {
    const response = await (input.fetchImpl ?? fetch)(url, { cache: 'no-store' });
    const body = await response.json().catch(() => null);
    const data = body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>).data
      : null;
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return { httpStatus: response.status, appId: null, valid: false, scopes: [], error: 'diagnostic_unavailable' };
    }
    const record = data as Record<string, unknown>;
    return {
      httpStatus: response.status,
      appId: record.app_id ? String(record.app_id) : null,
      valid: record.is_valid === true,
      tokenType: record.type ? String(record.type) : 'unknown',
      subjectId: record.user_id ? String(record.user_id) : null,
      scopes: Array.isArray(record.scopes) ? record.scopes.map((scope) => String(scope)).filter(Boolean) : [],
      error: response.ok ? null : 'diagnostic_unavailable',
    };
  } catch {
    return { httpStatus: null, appId: null, valid: false, scopes: [], error: 'diagnostic_unavailable' };
  }
}
