import { createClient } from '@/lib/supabase/server';
import type { TaskStatus, TaskPriority } from '@/lib/schemas/task';

export type TaskWithAssignee = {
  id: string;
  asset_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assigned_to: string | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  created_by: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
  assignee: { full_name: string } | null;
};

export async function getTasksForAsset(assetId: string): Promise<TaskWithAssignee[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('tasks')
    .select('*, assignee:team_members!assigned_to(full_name)')
    .eq('asset_id', assetId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  if (error) return [];
  return (data ?? []) as TaskWithAssignee[];
}

export type TeamMemberOption = {
  id: string;
  full_name: string;
};

export async function getTeamMembers(): Promise<TeamMemberOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('team_members')
    .select('id, full_name')
    .eq('is_active', true)
    .order('full_name');

  if (error) return [];
  return (data ?? []) as TeamMemberOption[];
}
