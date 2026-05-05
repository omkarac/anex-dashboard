'use server';

import { createServiceClient } from '@/lib/supabase/service';
import { withAudit } from '@/lib/actions/_base';
import type { ActionResult } from '@/lib/actions/_base';
import { revalidatePath } from 'next/cache';
import type { TaskStatus, TaskPriority } from '@/lib/schemas/task';

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

  if (result.ok) revalidatePath(`/assets/${assetId}`);
  return result;
}

export async function updateTaskStatus(
  taskId: string,
  assetId: string,
  status: TaskStatus
): Promise<ActionResult<void>> {
  const result = await withAudit({
    action: 'update',
    entityType: 'task',
    entityId: taskId,
    assetId,
    summary: `Task status changed to ${status}`,
    mutation: async (actorId) => {
      const service = createServiceClient();
      const patch: Record<string, unknown> = { status, updated_by: actorId };
      if (status === 'done') patch.completed_at = new Date().toISOString();
      else patch.completed_at = null;

      const { error } = await service.from('tasks').update(patch).eq('id', taskId);
      if (error) throw new Error(error.message);
    },
  });

  if (result.ok) revalidatePath(`/assets/${assetId}`);
  return result;
}

export async function updateTaskAssignee(
  taskId: string,
  assetId: string,
  assignedTo: string | null
): Promise<ActionResult<void>> {
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

  if (result.ok) revalidatePath(`/assets/${assetId}`);
  return result;
}

export async function deleteTask(
  taskId: string,
  assetId: string
): Promise<ActionResult<void>> {
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

  if (result.ok) revalidatePath(`/assets/${assetId}`);
  return result;
}

export async function createMilestoneTasks(assetId: string): Promise<void> {
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
