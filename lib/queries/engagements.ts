import { createServiceClient } from '@/lib/supabase/service';
import type { Engagement } from '@/lib/schemas/engagement';

export type EngagementWithActor = Engagement & {
  actor: { full_name: string } | null;
};

export async function getEngagementForAsset(
  assetId: string
): Promise<EngagementWithActor | null> {
  const service = createServiceClient();

  const { data: asset, error: assetError } = await service
    .from('assets')
    .select('converted_to_engagement_id')
    .eq('id', assetId)
    .single();

  if (assetError || !asset?.converted_to_engagement_id) return null;

  const { data, error } = await service
    .from('engagements')
    .select('*')
    .eq('id', asset.converted_to_engagement_id)
    .single();

  if (error || !data) return null;

  const { data: member } = await service
    .from('team_members')
    .select('full_name')
    .eq('id', data.created_by)
    .single();

  return { ...data, actor: member ?? null };
}
