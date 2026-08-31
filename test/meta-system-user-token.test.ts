import assert from 'node:assert/strict';
import test from 'node:test';

import { validateWhatsAppSystemUserToken } from '../src/lib/meta/system-user-token.ts';

const validDiagnostic = {
  httpStatus: 200,
  appId: '1691394752113175',
  valid: true,
  tokenType: 'SYSTEM_USER',
  subjectId: '122111165721433559',
  scopes: ['whatsapp_business_management', 'whatsapp_business_messaging'],
  error: null,
};

test('accepts only a valid system-user token from the main app with both WhatsApp scopes', () => {
  assert.deepEqual(validateWhatsAppSystemUserToken(validDiagnostic, '1691394752113175'), {
    ok: true,
    systemUserId: '122111165721433559',
    scopes: ['whatsapp_business_management', 'whatsapp_business_messaging'],
  });
});

test('rejects user tokens, wrong apps and missing scopes without returning a secret', () => {
  assert.equal(validateWhatsAppSystemUserToken({ ...validDiagnostic, tokenType: 'USER' }, '1691394752113175').ok, false);
  assert.equal(validateWhatsAppSystemUserToken({ ...validDiagnostic, appId: 'historical-app' }, '1691394752113175').ok, false);
  const missing = validateWhatsAppSystemUserToken({
    ...validDiagnostic,
    scopes: ['whatsapp_business_management'],
  }, '1691394752113175');
  assert.deepEqual(missing, { ok: false, reason: 'missing_required_scopes' });
  assert.equal(JSON.stringify(missing).includes('access_token'), false);
});
