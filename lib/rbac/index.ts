import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { IS_DEV_DEMO, getDemoMember } from '@/lib/auth/member';
import { redirect } from 'next/navigation';
import type { TeamMemberRole, MemberDepartment, MemberStatus } from '@/lib/schemas/team';

export type { TeamMemberRole };

export type TeamMember = {
  id: string;
  full_name: string;
  email: string;
  role: TeamMemberRole;
  department: MemberDepartment;
  status: MemberStatus;
  is_active: boolean;
  avatar_url: string | null;
  created_at: string;
};

export async function currentUser(): Promise<TeamMember> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (IS_DEV_DEMO) return getDemoMember();
    redirect('/login');
  }

  const { data: member } = await supabase
    .from('team_members')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!member) {
    // Auto-provision via service role (bypasses RLS). New members land in the
    // quarantine 'pending' state — no app access until an admin assigns a role +
    // department to release them (see the /pending holding page).
    const service = createServiceClient();
    const { error } = await service
      .from('team_members')
      .insert({
        id: user.id,
        full_name: user.email?.split('@')[0] ?? 'User',
        email: user.email!,
        role: 'member',
        status: 'pending',
        is_active: true,
      });

    if (error) redirect('/login');
    redirect('/pending');
  }

  if (!member.is_active) redirect('/login?error=deactivated');
  if (member.status === 'pending') redirect('/pending');

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

/**
 * Action-level admin guard. Unlike requireAdmin (which redirects — for pages),
 * this returns the member, or null when the caller is not an admin, so a server
 * action can return a clean { ok: false } instead of throwing a redirect across
 * the action boundary. Use in server actions; use requireAdmin in pages/layouts.
 */
export async function authorizeAdmin(): Promise<TeamMember | null> {
  const member = await currentUser();
  return member.role === 'admin' ? member : null;
}

/** Action-level sales-role guard. Returns the member, or null if not a sales role. */
export async function authorizeSalesRole(): Promise<TeamMember | null> {
  const member = await currentUser();
  return isSalesRole(member) ? member : null;
}

/**
 * Project IDs a member may access. Sales leadership (admin/sales_admin/sales_head)
 * gets 'all'; everyone else is scoped to their active project_sm_assignments.
 * Mirrors the DB RLS functions user_is_sales_admin() + user_assigned_project_ids()
 * so TypeScript ownership checks match RLS exactly.
 */
export async function getAccessibleProjectIds(
  member: TeamMember
): Promise<string[] | 'all'> {
  if (isSalesHead(member)) return 'all';
  const service = createServiceClient();
  const { data } = await service
    .from('project_sm_assignments')
    .select('project_id')
    .eq('sm_id', member.id)
    .eq('is_active', true);
  return (data ?? []).map((r) => r.project_id as string);
}

/** True if the member may act on records belonging to the given project. */
export async function canAccessProject(
  member: TeamMember,
  projectId: string | null | undefined
): Promise<boolean> {
  if (!projectId) return false;
  const ids = await getAccessibleProjectIds(member);
  return ids === 'all' || ids.includes(projectId);
}

/** True if the member may write capital-markets data (CM/both department, or admin). */
export function hasCmAccess(member: TeamMember): boolean {
  return (
    member.role === 'admin' ||
    member.department === 'cm' ||
    member.department === 'both'
  );
}

/** Action-level CM-write guard. Returns the member, or null without CM access. */
export async function authorizeCmWrite(): Promise<TeamMember | null> {
  const member = await currentUser();
  return hasCmAccess(member) ? member : null;
}
