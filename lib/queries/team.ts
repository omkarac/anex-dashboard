import { createServiceClient } from '@/lib/supabase/service';
import type { TeamMemberRole, MemberStatus } from '@/lib/schemas/team';

export type TeamMemberSelect = { id: string; full_name: string };

export async function getActiveTeamMembers(): Promise<TeamMemberSelect[]> {
  const service = createServiceClient();
  const { data } = await service
    .from('team_members')
    .select('id, full_name')
    .eq('is_active', true)
    .eq('status', 'active') // exclude quarantined ('pending') members from assignee pickers
    .order('full_name');
  return (data ?? []) as TeamMemberSelect[];
}

export type MemberDepartment = 'cm' | 'sm' | 'both' | null;

export type TeamMemberWithWorkload = {
  id: string;
  full_name: string;
  email: string;
  role: TeamMemberRole;
  department: MemberDepartment;
  status: MemberStatus;
  is_active: boolean;
  created_at: string;
  open_tasks: number;
  spoc_assets: number;
};

export async function listTeamMembers(): Promise<TeamMemberWithWorkload[]> {
  const service = createServiceClient();

  const [{ data: members }, { data: tasks }, { data: assets }] = await Promise.all([
    service.from('team_members').select('*').order('full_name'),
    service
      .from('tasks')
      .select('assigned_to')
      .is('deleted_at', null)
      .not('status', 'in', '("done","cancelled")')
      .not('assigned_to', 'is', null),
    service
      .from('assets')
      .select('spoc_agent')
      .is('deleted_at', null)
      .not('status', 'in', '("dropped","won")')
      .not('spoc_agent', 'is', null),
  ]);

  if (!members) return [];

  const taskMap = new Map<string, number>();
  for (const t of tasks ?? []) {
    taskMap.set(t.assigned_to, (taskMap.get(t.assigned_to) ?? 0) + 1);
  }

  const spocMap = new Map<string, number>();
  for (const a of assets ?? []) {
    const key = (a.spoc_agent as string).toLowerCase().trim();
    spocMap.set(key, (spocMap.get(key) ?? 0) + 1);
  }

  return members.map((m) => ({
    ...m,
    open_tasks: taskMap.get(m.id) ?? 0,
    spoc_assets: spocMap.get(m.full_name.toLowerCase().trim()) ?? 0,
  }));
}
