'use client';

import { createSupabaseAuthBrowserClient } from '@/lib/supabase/auth-client';

export function LogoutButton() {
  async function handleLogout() {
    const supabase = createSupabaseAuthBrowserClient();
    await supabase.auth.signOut();
    window.location.href = '/admin/login';
  }

  return (
    <button
      onClick={handleLogout}
      className="adminclose-btn"
    >
      ✕ Salir del Panel
    </button>
  );
}
