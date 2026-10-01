import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { OFFICIAL_SITE_URL } from '@/lib/site-url';
import { safeAdminCallbackPath } from '@/lib/auth/admin-auth-redirects';

// Maneja el callback de Supabase Auth (intercambio de código por sesión).
// Usado para: password reset, magic links, OAuth.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  const next = safeAdminCallbackPath(searchParams.get('next'));

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // setAll puede fallar en Server Components si los headers ya se enviaron
            }
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, OFFICIAL_SITE_URL));
    }
    console.error('Error exchanging code for session:', error.message);
  }

  // Si no hay code o falló el intercambio, redirigir al login con error
  return NextResponse.redirect(new URL('/admin/login?error=callback-failed', OFFICIAL_SITE_URL));
}
