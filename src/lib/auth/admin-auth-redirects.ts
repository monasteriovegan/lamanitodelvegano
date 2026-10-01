import { OFFICIAL_SITE_URL } from '../site-url.ts';

const ADMIN_HOME_PATH = '/admin/productos';
const ADMIN_UPDATE_PASSWORD_PATH = '/admin/update-password';

export function adminRecoveryRedirectUrl() {
  return `${OFFICIAL_SITE_URL}/admin/callback?next=${ADMIN_UPDATE_PASSWORD_PATH}`;
}

export function safeAdminCallbackPath(raw: string | null) {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) {
    return ADMIN_HOME_PATH;
  }

  try {
    const parsed = new URL(raw, OFFICIAL_SITE_URL);
    if (parsed.origin !== OFFICIAL_SITE_URL || !parsed.pathname.startsWith('/admin/')) {
      return ADMIN_HOME_PATH;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return ADMIN_HOME_PATH;
  }
}
