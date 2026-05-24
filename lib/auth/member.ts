import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import type { TeamMember } from '@/lib/rbac';

// Localhost demo flag — true only under `next dev`. Vercel builds run with
// NODE_ENV='production', so demo auth bypass NEVER applies in any deployment.
export const IS_DEV_DEMO = process.env.NODE_ENV === 'development';

const DEMO_FALLBACK: TeamMember = {
  id: '00000000-0000-0000-0000-000000000000',
  full_name: 'Demo Admin',
  email: 'demo@anexadvisory.com',
  role: 'admin',
  department: 'both',
  status: 'active',
  is_active: true,
  avatar_url: null,
  created_at: '1970-01-01T00:00:00.000Z',
};

const MEMBER_COLS = 'id, full_name, email, role, department, status, is_active, avatar_url, created_at';

// Demo identity for no-login localhost runs. Prefers a real admin (so writes
// satisfy team_members FKs), then any active member, then a synthetic admin.
export async function getDemoMember(): Promise<TeamMember> {
  const service = createServiceClient();
  const admin = await service
    .from('team_members')
    .select(MEMBER_COLS)
    .eq('is_active', true)
    .eq('role', 'admin')
    .order('created_at')
    .limit(1)
    .maybeSingle();
  if (admin.data) return admin.data as TeamMember;

  const any = await service
    .from('team_members')
    .select(MEMBER_COLS)
    .eq('is_active', true)
    .order('created_at')
    .limit(1)
    .maybeSingle();
  if (any.data) return any.data as TeamMember;

  return DEMO_FALLBACK;
}

export async function getAuthenticatedMember(): Promise<TeamMember> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    if (IS_DEV_DEMO) return getDemoMember();
    redirect('/login');
  }

  const service = createServiceClient();
  let { data: member } = await service
    .from('team_members')
    .select(MEMBER_COLS)
    .eq('id', user.id)
    .single();

  if (!member) {
    // New members are quarantined ('pending') until an admin assigns role +
    // department. They go to the holding page, not into the app.
    const { error } = await service
      .from('team_members')
      .insert({
        id: user.id,
        full_name: user.email!.split('@')[0],
        email: user.email!,
        role: 'member',
        status: 'pending',
        is_active: true,
      });
    if (error) redirect('/login');
    redirect('/pending');
  }

  if (!member.is_active) redirect('/login');
  if (member.status === 'pending') redirect('/pending');
  return member as TeamMember;
}
