'use server';

import { createServiceClient } from '@/lib/supabase/service';
import { withAudit } from '@/lib/actions/_base';
import type { ActionResult } from '@/lib/actions/_base';
import { revalidatePath } from 'next/cache';

export type CreateUpdateInput = {
  update_date: string;   // YYYY-MM-DD — date the event occurred
  update_task: string;   // what happened / needs to happen
  comment?: string;      // additional context (optional)
};

export async function createUpdate(
  assetId: string,
  input: CreateUpdateInput,
): Promise<ActionResult<void>> {
  const task = input.update_task.trim();
  if (!task) return { ok: false, error: 'Update description cannot be empty' };

  const comment = input.comment?.trim() || null;
  const body = comment ? `${task}\n${comment}` : task;

  const result = await withAudit({
    action: 'create',
    entityType: 'update',
    entityId: assetId,
    assetId,
    summary: `Update logged: ${task.slice(0, 80)}${task.length > 80 ? '…' : ''}`,
    mutation: async (actorId) => {
      const service = createServiceClient();
      const { error } = await service.from('updates').insert({
        asset_id: assetId,
        body,
        update_date: input.update_date,
        update_task: task,
        comment,
        created_by: actorId,
      });
      if (error) throw new Error(error.message);
    },
  });

  if (result.ok) {
    revalidatePath(`/capital-markets/assets/${assetId}`);
    revalidatePath('/capital-markets/assets');
  }
  return result;
}

export async function deleteUpdate(
  updateId: string,
  assetId: string,
): Promise<ActionResult<void>> {
  const result = await withAudit({
    action: 'delete',
    entityType: 'update',
    entityId: updateId,
    assetId,
    summary: 'Update deleted',
    mutation: async (actorId) => {
      const service = createServiceClient();
      const { error } = await service
        .from('updates')
        .update({ deleted_at: new Date().toISOString(), deleted_by: actorId })
        .eq('id', updateId);
      if (error) throw new Error(error.message);
    },
  });

  if (result.ok) revalidatePath(`/capital-markets/assets/${assetId}`);
  return result;
}
