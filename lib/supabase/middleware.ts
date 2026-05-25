import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: use getUser() not getSession() — getSession() reads an
  // unverified JWT from the cookie and can let expired sessions through.
  const { data: { user } } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isPublicRoute =
    pathname === '/login' ||
    pathname === '/ui-demo' ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon');

  // Localhost demo: skip the login gate in development only. Production builds
  // (Vercel) run with NODE_ENV='production', so real auth is always enforced there.
  const demoBypass = process.env.NODE_ENV === 'development';

  if (!user && !isPublicRoute && !demoBypass) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Must return supabaseResponse — not NextResponse.next() — so that
  // refreshed session cookies are forwarded to the browser.
  return supabaseResponse;
}
