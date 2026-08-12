import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export async function createSupabaseServerAuthClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {}
        },
      },
    }
  );
}

export async function getCurrentAdminUser() {
  try {
    const supabaseAuth = await createSupabaseServerAuthClient();
    const { data: { user }, error } = await supabaseAuth.auth.getUser();
    
    if (error || !user) return null;

    // Usar service role para leer admin_roles sin problemas de RLS
    const supabaseService = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const { data: rolRow, error: rolError } = await supabaseService
      .from('admin_roles')
      .select('rol')
      .eq('user_id', user.id)
      .maybeSingle();

    if (rolError) {
      console.error('Error leyendo admin_roles:', rolError);
      return null;
    }

    if (!rolRow) return null;
    return { id: user.id, email: user.email, rol: rolRow.rol };
  } catch (err) {
    console.error('getCurrentAdminUser error:', err);
    return null;
  }
}
