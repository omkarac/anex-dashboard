import { createServerClient } from '@supabase/ssr';
import { createServiceClient } from '@/lib/supabase/service';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

// ─── ISOLATED AZURE SSO TEST ──────────────────────────────────────────────────
// This route is intentionally separate from /app/auth/callback/route.ts.
// It is used ONLY to validate the Microsoft OAuth flow end-to-end before
// we switch it to primary login. Delete this file once the switch is made.
// ──────────────────────────────────────────────────────────────────────────────

const ALLOWED_DOMAIN = 'anexadvisory.com';

export async function GET(request: NextRequest) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get('code');

  if (!code) {
        return NextResponse.redirect(`${origin}/auth-test?error=no_code`);
  }

  const cookieStore = await cookies();
    const redirectTo = NextResponse.redirect(`${origin}/auth-test/success`);

  // Auth client — writes session cookies onto the redirect response
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
          console.error('[auth-test/callback] exchangeCodeForSession error:', error.message);
          return NextResponse.redirect(`${origin}/auth-test?error=exchange_failed`);
    }

  const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
          return NextResponse.redirect(`${origin}/auth-test?error=no_user`);
    }

  // ── SERVER-SIDE DOMAIN ENFORCEMENT ────────────────────────────────────────
  if (!user.email?.endsWith(`@${ALLOWED_DOMAIN}`)) {
        console.warn(`[auth-test/callback] Blocked sign-in from: ${user.email}`);
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}/auth-test?error=unauthorized_domain`);
  }
    // ──────────────────────────────────────────────────────────────────────────

  // Provision into team_members if needed (same logic as production callback)
  const service = createServiceClient();

  const { data: existing } = await service
      .from('team_members')
      .select('id, is_active')
      .eq('id', user.id)
      .single();

  if (!existing) {
        await service.from('team_members').insert({
                id: user.id,
                full_name: user.email!.split('@')[0],
                email: user.email!,
                role: 'member',
                is_active: true,
        });
  } else if (!existing.is_active) {
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}/auth-test?error=deactivated`);
  }

  return redirectTo;
}
