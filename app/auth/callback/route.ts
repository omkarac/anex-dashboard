import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// Handles Supabase session refresh redirects (not used in password login flow,
// kept for future OAuth/magic-link switch)
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=exchange_failed`);
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  // Auto-provision member if not exists
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

  return NextResponse.redirect(`${origin}/`);
}
