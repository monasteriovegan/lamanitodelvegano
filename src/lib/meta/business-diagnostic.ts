type SafeUser = { id: string; name: string | null; role?: string | null; tasks?: string[] };

async function graphData(url: URL, token: string, fetchImpl: typeof fetch) {
  try {
    const response = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
    });
    const body = await response.json().catch(() => null);
    return { response, body };
  } catch {
    return { response: null, body: null };
  }
}

function safeUsers(body: unknown): SafeUser[] {
  if (!body || typeof body !== 'object' || !Array.isArray((body as Record<string, unknown>).data)) return [];
  return ((body as Record<string, unknown>).data as unknown[]).flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    const id = String(record.id || '').trim();
    if (!id) return [];
    return [{
      id,
      name: String(record.name || '').trim() || null,
      ...(record.role ? { role: String(record.role) } : {}),
      ...(Array.isArray(record.tasks) ? { tasks: record.tasks.map((task) => String(task)).filter(Boolean) } : {}),
    }];
  });
}

function hasApp(body: unknown, appId: string) {
  if (!body || typeof body !== 'object' || !Array.isArray((body as Record<string, unknown>).data)) return false;
  return ((body as Record<string, unknown>).data as unknown[]).some((item) => (
    item && typeof item === 'object' && String((item as Record<string, unknown>).id || '') === appId
  ));
}

export async function diagnoseMetaBusinessAssignments(input: {
  graphVersion: string;
  wabaId: string;
  appId: string;
  token: string;
  fetchImpl?: typeof fetch;
}) {
  const fetchImpl = input.fetchImpl ?? fetch;
  const base = `https://graph.facebook.com/${encodeURIComponent(input.graphVersion)}`;
  const ownerUrl = new URL(`${base}/${encodeURIComponent(input.wabaId)}`);
  ownerUrl.searchParams.set('fields', 'owner_business_info');
  const ownerResult = await graphData(ownerUrl, input.token, fetchImpl);
  const ownerInfo = ownerResult.body && typeof ownerResult.body === 'object'
    ? (ownerResult.body as Record<string, unknown>).owner_business_info
    : null;
  const ownerRecord = ownerInfo && typeof ownerInfo === 'object' ? ownerInfo as Record<string, unknown> : null;
  const ownerBusiness = {
    id: String(ownerRecord?.id || '').trim() || null,
    name: String(ownerRecord?.name || '').trim() || null,
    httpStatus: ownerResult.response?.status ?? null,
  };
  if (!ownerBusiness.id) {
    return { ownerBusiness, systemUsers: [], assignedUsers: [], appRelationship: { businessId: null, relation: 'unknown' as const } };
  }

  const systemUsersUrl = new URL(`${base}/${encodeURIComponent(ownerBusiness.id)}/system_users`);
  const assignedUrl = new URL(`${base}/${encodeURIComponent(input.wabaId)}/assigned_users`);
  assignedUrl.searchParams.set('business', ownerBusiness.id);
  const ownedAppsUrl = new URL(`${base}/${encodeURIComponent(ownerBusiness.id)}/owned_apps`);
  ownedAppsUrl.searchParams.set('fields', 'id,name');
  const clientAppsUrl = new URL(`${base}/${encodeURIComponent(ownerBusiness.id)}/client_apps`);
  clientAppsUrl.searchParams.set('fields', 'id,name');
  const [systemUsersResult, assignedResult, ownedAppsResult, clientAppsResult] = await Promise.all([
    graphData(systemUsersUrl, input.token, fetchImpl),
    graphData(assignedUrl, input.token, fetchImpl),
    graphData(ownedAppsUrl, input.token, fetchImpl),
    graphData(clientAppsUrl, input.token, fetchImpl),
  ]);
  const relation = hasApp(ownedAppsResult.body, input.appId)
    ? 'owned'
    : hasApp(clientAppsResult.body, input.appId) ? 'client' : 'none';
  return {
    ownerBusiness,
    systemUsers: safeUsers(systemUsersResult.body),
    assignedUsers: safeUsers(assignedResult.body),
    appRelationship: { businessId: ownerBusiness.id, relation },
  };
}
