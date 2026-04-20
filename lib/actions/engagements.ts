'use server';

import { createServiceClient } from '@/lib/supabase/service';
import { withAudit } from '@/lib/actions/_base';
import type { ActionResult } from '@/lib/actions/_base';
import type { EngagementKind } from '@/lib/schemas/engagement';
import { revalidatePath } from 'next/cache';

export async function convertToEngagement(
  assetId: string,
  kind: EngagementKind,
  startedAt: string,
  notes: string
): Promise<ActionResult<{ engagementId: string }>> {
  const result = await withAudit({
    action: 'convert',
    entityType: 'asset',
    entityId: assetId,
    assetId,
    summary: `Converted to engagement (${kind})`,
    mutation: async (actorId) => {
      const service = createServiceClient();

      const { data: engagement, error: engError } = await service
        .from('engagements')
        .insert({
          asset_id: assetId,
          kind,
          started_at: startedAt,
          notes: notes.trim() || null,
          created_by: actorId,
        })
        .select('id')
        .single();

      if (engError || !engagement) throw new Error(engError?.message ?? 'Failed to create engagement');

      const { error: assetError } = await service
        .from('assets')
        .update({
          converted_to_engagement_id: engagement.id,
          status: 'won',
          updated_by: actorId,
        })
        .eq('id', assetId);

      if (assetError) throw new Error(assetError.message);

      return { engagementId: engagement.id };
    },
  });

  if (result.ok) revalidatePath(`/assets/${assetId}`);
  return result;
}
