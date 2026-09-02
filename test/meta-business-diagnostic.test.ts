import assert from 'node:assert/strict';
import test from 'node:test';

import { diagnoseMetaBusinessAssignments } from '../src/lib/meta/business-diagnostic.ts';

test('discovers WABA owner, system users, assignments and app relationship without leaking token', async () => {
  const calls: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    const url = new URL(String(input));
    calls.push(`${url.pathname}${url.search}`);
    if (url.pathname.endsWith('/waba-1')) return new Response(JSON.stringify({ owner_business_info: { id: 'business-1', name: 'Owner' } }));
    if (url.pathname.endsWith('/waba-1/assigned_users')) return new Response(JSON.stringify({ data: [{ id: 'su-1', name: 'Operator', tasks: ['MANAGE'] }] }));
    if (url.pathname.endsWith('/business-1/system_users')) return new Response(JSON.stringify({ data: [{ id: 'su-1', name: 'Operator', role: 'ADMIN' }] }));
    if (url.pathname.endsWith('/business-1/owned_apps')) return new Response(JSON.stringify({ data: [{ id: 'app-1', name: 'Synthetiq Core' }] }));
    if (url.pathname.endsWith('/business-1/client_apps')) return new Response(JSON.stringify({ data: [] }));
    return new Response(JSON.stringify({ error: { code: 100 } }), { status: 400 });
  };
  const result = await diagnoseMetaBusinessAssignments({
    graphVersion: 'v26.0', wabaId: 'waba-1', appId: 'app-1', token: 'server-secret', fetchImpl,
  });
  assert.equal(result.ownerBusiness.id, 'business-1');
  assert.deepEqual(result.assignedUsers, [{ id: 'su-1', name: 'Operator', tasks: ['MANAGE'] }]);
  assert.deepEqual(result.systemUsers, [{ id: 'su-1', name: 'Operator', role: 'ADMIN' }]);
  assert.deepEqual(result.appRelationship, { businessId: 'business-1', relation: 'owned' });
  assert.equal(JSON.stringify(result).includes('server-secret'), false);
  assert.equal(calls.some((url) => url.includes('assigned_users?business=business-1')), true);
});
