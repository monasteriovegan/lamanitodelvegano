import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Solo aplica a rutas /admin
  if (!pathname.startsWith('/admin')) {
    return NextResponse.next();
  }

  // Dejar pasar rutas de auth SIN verificar sesión — evita loops
  const authPaths = ['/admin/login', '/admin/update-password', '/admin/callback'];
  if (authPaths.includes(pathname)) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  try {
    // Verificar sesión con anon key + cookies
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            response = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          },
        },
      }
    );

    const { data: userData, error } = await supabase.auth.getUser();

    if (error || !userData.user) {
      const loginUrl = new URL('/admin/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
  } catch (err) {
    // Si el proxy falla por cualquier razón, redirigir al login en vez de 500
    console.error('Proxy auth error:', err);
    const loginUrl = new URL('/admin/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // No verificamos admin_roles aquí para evitar latencia y posibles errores de RLS
  // La verificación de rol real ocurre en getCurrentAdminUser() del layout
  return response;
}

export const config = {
  matcher: ['/admin/:path*'],
};
