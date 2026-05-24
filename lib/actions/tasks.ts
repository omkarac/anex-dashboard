'use server';

import { createServiceClient } from '@/lib/supabase/service';
import { withAudit } from '@/lib/actions/_base';
import type { ActionResult } from '@/lib/actions/_base';
import { revalidatePath } from 'next/cache';
import { authorizeCmWrite, authorizeAdmin } from '@/lib/rbac';
import type { TaskStatus, TaskPriority } from '@/lib/schemas/task';

const CM_FORBIDDEN = 'Forbidden — capital-markets access required' as const;

export async function createTask(
  assetId: string,
  data: {
    title: string;
    priority?: TaskPriority;
    due_date?: string | null;
    assigned_to?: string | null;
    description?: string | null;
  }
): Promise<ActionResult<void>> {
  const member = await authorizeCmWrite();
  if (!member) return { ok: false, error: CM_FORBIDDEN };
  if (!data.title.trim()) return { ok: false, error: 'Title is required' };

  const result = await withAudit({
    action: 'create',
    entityType: 'task',
    entityId: assetId,
    assetId,
    summary: `Task created: ${data.title}`,
    mutation: async (actorId) => {
      const service = createServiceClient();
      const { error } = await service.from('tasks').insert({
        asset_id: assetId,
        title: data.title.trim(),
        priority: data.priority ?? 'medium',
        due_date: data.due_date ?? null,
        assigned_to: data.assigned_to ?? null,
        description: data.description ?? null,
        created_by: actorId,
      });
      if (error) throw new Error(error.message);
    },
  });

  if (result.ok) revalidatePath(`/capital-markets/assets/${assetId}`);
  return result;
}

export async function updateTaskStatus(
  taskId: string,
  assetId: string,
  status: TaskStatus,
  fileUrl?: string | null
): Promise<ActionResult<void>> {
  const member = await authorizeCmWrite();
  if (!member) return { ok: false, error: CM_FORBIDDEN };

  const result = await withAudit({
    action: 'update',
    entityType: 'task',
    entityId: taskId,
    assetId,
    summary: `Task status changed to ${status}`,
    mutation: async (actorId) => {
      const service = createServiceClient();
      const patch: Record<string, unknown> = { status, updated_by: actorId };
      if (status === 'done') {
        patch.completed_at = new Date().toISOString();
        if (fileUrl !== undefined) patch.file_url = fileUrl || null;
      } else {
        patch.completed_at = null;
      }
      const { error } = await service.from('tasks').update(patch).eq('id', taskId);
      if (error) throw new Error(error.message);
    },
  });

  if (result.ok) revalidatePath(`/capital-markets/assets/${assetId}`);
  return result;
}

export async function setTaskFileUrl(
  taskId: string,
  assetId: string,
  fileUrl: string | null
): Promise<ActionResult<void>> {
  const member = await authorizeCmWrite();
  if (!member) return { ok: false, error: CM_FORBIDDEN };

  const result = await withAudit({
    action: 'update',
    entityType: 'task',
    entityId: taskId,
    assetId,
    summary: fileUrl ? 'File link attached to task' : 'File link removed from task',
    mutation: async (actorId) => {
      const service = createServiceClient();
      const { error } = await service
        .from('tasks')
        .update({ file_url: fileUrl, updated_by: actorId })
        .eq('id', taskId);
      if (error) throw new Error(error.message);
    },
  });

  if (result.ok) revalidatePath(`/capital-markets/assets/${assetId}`);
  return result;
}

export async function updateTaskAssignee(
  taskId: string,
  assetId: string,
  assignedTo: string | null
): Promise<ActionResult<void>> {
  const member = await authorizeCmWrite();
  if (!member) return { ok: false, error: CM_FORBIDDEN };

  const result = await withAudit({
    action: 'update',
    entityType: 'task',
    entityId: taskId,
    assetId,
    summary: assignedTo ? 'Task reassigned' : 'Task unassigned',
    mutation: async (actorId) => {
      const service = createServiceClient();
      const { error } = await service
        .from('tasks')
        .update({ assigned_to: assignedTo, updated_by: actorId })
        .eq('id', taskId);
      if (error) throw new Error(error.message);
    },
  });

  if (result.ok) revalidatePath(`/capital-markets/assets/${assetId}`);
  return result;
}

export async function deleteTask(
  taskId: string,
  assetId: string
): Promise<ActionResult<void>> {
  const admin = await authorizeAdmin();
  if (!admin) return { ok: false, error: 'Forbidden — admin access required' };

  const result = await withAudit({
    action: 'delete',
    entityType: 'task',
    entityId: taskId,
    assetId,
    summary: 'Task deleted',
    mutation: async (actorId) => {
      const service = createServiceClient();
      const { error } = await service
        .from('tasks')
        .update({ deleted_at: new Date().toISOString(), deleted_by: actorId })
        .eq('id', taskId);
      if (error) throw new Error(error.message);
    },
  });

  if (result.ok) revalidatePath(`/capital-markets/assets/${assetId}`);
  return result;
}

export async function createMilestoneTasks(assetId: string): Promise<void> {
  // Internal helper invoked by createAsset (already CM-gated). Guard anyway so a
  // direct client invocation of this 'use server' export can't seed tasks.
  const member = await authorizeCmWrite();
  if (!member) return;

  const service = createServiceClient();
  const { data: actor } = await service
    .from('team_members')
    .select('id')
    .eq('is_active', true)
    .order('created_at')
    .limit(1)
    .single();
  if (!actor) return;

  const titles = ['Feasibility', 'Information Memorandum (IM)'];
  for (const title of titles) {
    const { data: existing } = await service
      .from('tasks')
      .select('id')
      .eq('asset_id', assetId)
      .eq('title', title)
      .eq('is_milestone', true)
      .is('deleted_at', null)
      .maybeSingle();
    if (!existing) {
      await service.from('tasks').insert({
        asset_id: assetId,
        title,
        is_milestone: true,
        status: 'todo',
        priority: 'high',
        created_by: actor.id,
      });
    }
  }
}
