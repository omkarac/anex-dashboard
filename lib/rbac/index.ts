import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { redirect } from 'next/navigation';

export type TeamMemberRole = 'admin' | 'member' | 'sales_manager' | 'sales_head' | 'sales_admin';

export type TeamMember = {
  id: string;
  full_name: string;
  email: string;
  role: TeamMemberRole;
  is_active: boolean;
  avatar_url: string | null;
  created_at: string;
};

export async function currentUser(): Promise<TeamMember> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: member } = await supabase
    .from('team_members')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!member) {
    // Auto-provision via service role (bypasses RLS)
    const service = createServiceClient();
    const { data: newMember, error } = await service
      .from('team_members')
      .insert({
        id: user.id,
        full_name: user.email?.split('@')[0] ?? 'User',
        email: user.email!,
        role: 'member',
        is_active: true,
      })
      .select()
      .single();

    if (error || !newMember) redirect('/login');
    return newMember as TeamMember;
  }

  if (!member.is_active) redirect('/login?error=deactivated');

  return member as TeamMember;
}

export async function requireAdmin(): Promise<TeamMember> {
  const member = await currentUser();
  if (member.role !== 'admin') redirect('/');
  return member;
}

export function isAdmin(member: TeamMember) {
  return member.role === 'admin';
}

export function isSalesRole(member: TeamMember) {
  return ['admin', 'sales_admin', 'sales_head', 'sales_manager'].includes(member.role);
}

export function isSalesAdmin(member: TeamMember) {
  return ['admin', 'sales_admin'].includes(member.role);
}

export function isSalesHead(member: TeamMember) {
  return ['admin', 'sales_admin', 'sales_head'].includes(member.role);
}

export async function requireSalesRole(): Promise<TeamMember> {
  const member = await currentUser();
  if (!isSalesRole(member)) redirect('/');
  return member;
}

export async function getAuthenticatedMember(): Promise<TeamMember> {
  return currentUser();
}
