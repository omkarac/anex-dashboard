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
    summary: `Task status changed to ${status}`,
    mutation: async (actorId) => {
      const service = createServiceClient();
      const update: Record<string, unknown> = { status, updated_by: actorId };
      if (status === 'done') update.completed_at = new Date().toISOString();
      if (status !== 'done') update.completed_at = null;

      const { error } = await service.from('tasks').update(update).eq('id', taskId);
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
