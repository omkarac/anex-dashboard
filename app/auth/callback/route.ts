import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const cookieStore = await cookies();

  // The redirect response is created first so we can attach session cookies to it.
  // cookies() from next/headers is read-only in Route Handlers — setAll must
  // write directly onto the response object or the session never reaches the browser.
  const redirectTo = NextResponse.redirect(`${origin}/`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            redirectTo.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=exchange_failed`);
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  // Auto-provision team_members row on first login
  const { data: existing } = await supabase
    .from('team_members')
    .select('id, is_active')
    .eq('id', user.id)
    .single();

  if (!existing && user.email) {
    await supabase.from('team_members').insert({
      id: user.id,
      full_name: user.email.split('@')[0],
      email: user.email,
      role: 'member',
      is_active: true,
    });
  } else if (existing && !existing.is_active) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=deactivated`);
  }

  return redirectTo;
}
