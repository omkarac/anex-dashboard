'use server';

import { createServiceClient } from '@/lib/supabase/service';
import { withAudit } from '@/lib/actions/_base';
import type { ActionResult } from '@/lib/actions/_base';
import { revalidatePath } from 'next/cache';

export async function createUpdate(
  assetId: string,
  body: string
): Promise<ActionResult<void>> {
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: 'Update body cannot be empty' };

  const result = await withAudit({
    action: 'create',
    entityType: 'update',
    entityId: assetId,
    summary: 'Update added',
    mutation: async (actorId) => {
      const service = createServiceClient();
      const { error } = await service.from('updates').insert({
        asset_id: assetId,
        body: trimmed,
        created_by: actorId,
      });
      if (error) throw new Error(error.message);
    },
  });

  if (result.ok) revalidatePath(`/assets/${assetId}`);
  return result;
}

export async function deleteUpdate(
  updateId: string,
  assetId: string
): Promise<ActionResult<void>> {
  const result = await withAudit({
    action: 'delete',
    entityType: 'update',
    entityId: updateId,
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

  if (result.ok) revalidatePath(`/assets/${assetId}`);
  return result;
}
