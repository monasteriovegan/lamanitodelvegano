import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
  matcher: ['/admin/:path*'],
};
