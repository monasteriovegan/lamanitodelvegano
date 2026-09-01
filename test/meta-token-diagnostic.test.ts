import assert from 'node:assert/strict';
import test from 'node:test';

import { diagnoseMetaToken } from '../src/lib/meta/token-diagnostic.ts';

test('token diagnostic exposes issuer, validity and scopes but never either token', async () => {
  let requested = '';
  const result = await diagnoseMetaToken({
    graphVersion: 'v26.0',
    token: 'user-secret',
    appId: 'main-app',
    appSecret: 'app-secret',
    fetchImpl: async (url) => {
      requested = String(url);
      return new Response(JSON.stringify({ data: {
        app_id: 'historical-app', type: 'SYSTEM_USER', is_valid: true, scopes: ['whatsapp_business_management'],
        granular_scopes: [
          { scope: 'whatsapp_business_management', target_ids: ['waba-1'] },
          { scope: 'public_profile' },
        ],
        user_id: 'private-user', data_access_expires_at: 123,
      } }), { status: 200 });
    },
  });
  assert.deepEqual(result, {
    httpStatus: 200, appId: 'historical-app', valid: true,
    tokenType: 'SYSTEM_USER', subjectId: 'private-user',
    scopes: ['whatsapp_business_management'],
    granularScopes: [
      { scope: 'whatsapp_business_management', targetIds: ['waba-1'] },
      { scope: 'public_profile', targetIds: [] },
    ],
    error: null,
  });
  assert.match(requested, /debug_token/);
  assert.equal(JSON.stringify(result).includes('user-secret'), false);
  assert.equal(JSON.stringify(result).includes('app-secret'), false);
  assert.equal(result.subjectId, 'private-user');
});
