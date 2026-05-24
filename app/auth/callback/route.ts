import { createServerClient } from '@supabase/ssr';
import { createServiceClient } from '@/lib/supabase/service';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const cookieStore = await cookies();
  const redirectTo = NextResponse.redirect(`${origin}/`);

  // Auth client — must write session cookies onto the redirect response
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
    console.error('[auth/callback] exchangeCodeForSession error:', error.message);
    return NextResponse.redirect(`${origin}/login?error=exchange_failed`);
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login`);
  }

  // Domain restriction — enforced server-side regardless of login method
  const email = user.email ?? '';
  if (!email.endsWith('@anexadvisory.com')) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=domain_not_allowed`);
  }

  // Service client bypasses RLS — required for INSERT since only admins
  // can write via RLS, but we need to self-provision on first login.
  const service = createServiceClient();

  const { data: existing } = await service
    .from('team_members')
    .select('id, is_active, status')
    .eq('id', user.id)
    .single();

  if (!existing) {
    // First login → quarantine. The member waits on the holding page until an
    // admin assigns a role + department to release them.
    await service.from('team_members').insert({
      id: user.id,
      full_name: user.email!.split('@')[0],
      email: user.email!,
      role: 'member',
      status: 'pending',
      is_active: true,
    });
    return NextResponse.redirect(`${origin}/pending`);
  }

  if (!existing.is_active) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=deactivated`);
  }

  if (existing.status === 'pending') {
    return NextResponse.redirect(`${origin}/pending`);
  }

  return redirectTo;
}
