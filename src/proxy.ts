import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { shouldBlockRequestDuringCutover } from '@/lib/runtime/cutover-freeze';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (shouldBlockRequestDuringCutover(pathname, request.method)) {
    const headers = {
      'Cache-Control': 'no-store',
      'Retry-After': '60',
    };
    if (!pathname.startsWith('/api/')) {
      return new NextResponse(
        '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>La Manito</title></head><body><main><h1>Servicio temporalmente en mantenimiento</h1><p>Volveremos en unos minutos. Gracias por tu paciencia.</p></main></body></html>',
        { status: 503, headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' } },
      );
    }
    return NextResponse.json(
      { error: 'cutover_freeze' },
      { status: 503, headers },
    );
  }

  if (!pathname.startsWith('/admin')) {
    return NextResponse.next();
  }

  // Estos dos recursos no contienen datos administrativos. Deben poder ser
  // actualizados por una PWA ya instalada incluso si la sesión expiró.
  const pwaAssets = ['/admin/wonka-sw.js', '/admin/manifest.webmanifest'];
  if (pwaAssets.includes(pathname)) return NextResponse.next();

  const authPaths = ['/admin/login', '/admin/update-password', '/admin/callback'];
  if (authPaths.includes(pathname)) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  try {
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
    console.error('Proxy auth error:', err);
    const loginUrl = new URL('/admin/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
