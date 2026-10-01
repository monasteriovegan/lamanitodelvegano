'use client';

import { useEffect, useState } from 'react';
import {
  parseRecoverySessionHash,
  safeAdminCallbackPath,
} from '@/lib/auth/admin-auth-redirects';
import { OFFICIAL_SITE_URL } from '@/lib/site-url';
import { createSupabaseAuthBrowserClient } from '@/lib/supabase/auth-client';

const CALLBACK_ERROR_URL = `${OFFICIAL_SITE_URL}/admin/login?error=callback-failed`;

export default function AdminAuthCallbackPage() {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;

    async function completeCallback() {
      const currentUrl = new URL(window.location.href);
      const code = currentUrl.searchParams.get('code');
      const next = safeAdminCallbackPath(currentUrl.searchParams.get('next'));
      const recoverySession = parseRecoverySessionHash(currentUrl.hash);

      // Remove recovery tokens (and the one-time PKCE code) from the address bar
      // before making any asynchronous request or rendering an error.
      const cleanCallbackUrl = new URL('/admin/callback', window.location.origin);
      cleanCallbackUrl.searchParams.set('next', next);
      window.history.replaceState(null, '', cleanCallbackUrl);

      const supabase = createSupabaseAuthBrowserClient();
      let error: Error | null = null;

      if (code) {
        const result = await supabase.auth.exchangeCodeForSession(code);
        error = result.error;
      } else if (recoverySession) {
        const result = await supabase.auth.setSession({
          access_token: recoverySession.accessToken,
          refresh_token: recoverySession.refreshToken,
        });
        error = result.error;
      } else {
        error = new Error('Missing authentication callback credentials');
      }

      if (!error) {
        window.location.replace(new URL(next, OFFICIAL_SITE_URL));
        return;
      }

      if (active) {
        setFailed(true);
      }
      window.location.replace(CALLBACK_ERROR_URL);
    }

    void completeCallback();
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center bg-fondo px-4">
      <div className="glass rounded-2xl p-8 w-full max-w-[380px] text-center">
        <span className="inline-flex w-12 h-12 rounded-full bg-[rgba(0,255,179,0.15)] border border-[rgba(0,255,179,0.3)] items-center justify-center text-2xl mb-3">
          🌱
        </span>
        <h1 className="font-display font-bold text-lg text-white mb-2">
          {failed ? 'No se pudo verificar el enlace' : 'Verificando acceso…'}
        </h1>
        <p className="text-xs text-muted">
          {failed ? 'Te llevaremos de vuelta al inicio de sesión.' : 'Espera un momento.'}
        </p>
      </div>
    </main>
  );
}
