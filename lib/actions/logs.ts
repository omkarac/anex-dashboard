'use server';

import { createServiceClient } from '@/lib/supabase/service';
import { withAudit } from '@/lib/actions/_base';
import type { ActionResult } from '@/lib/actions/_base';
import { revalidatePath } from 'next/cache';

export async function deleteActivityLog(
  logId: string,
  reason: string
): Promise<ActionResult<void>> {
  const trimmedReason = reason.trim();
  if (!trimmedReason) return { ok: false, error: 'Reason is required' };

  const result = await withAudit({
    action: 'delete',
    entityType: 'activity_log',
    entityId: logId,
    summary: `Deleted a log entry. Reason: ${trimmedReason}`,
    mutation: async (actorId) => {
      const service = createServiceClient();
      const { error } = await service
        .from('activity_logs')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: actorId,
          delete_reason: trimmedReason,
        })
        .eq('id', logId);
      if (error) throw new Error(error.message);
    },
  });

  if (result.ok) revalidatePath('/capital-markets/logs'); revalidatePath('/sales-marketing/logs');
  return result;
}
