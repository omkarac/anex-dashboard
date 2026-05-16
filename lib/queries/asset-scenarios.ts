import { createServiceClient } from '@/lib/supabase/service';
import type { AssetScenario } from '@/lib/schemas/asset-scenario';

export async function getScenariosForAsset(assetId: string): Promise<AssetScenario[]> {
  const service = createServiceClient();
  const { data, error } = await service
    .from('asset_scenarios')
    .select('*')
    .eq('asset_id', assetId)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) return [];
  return (data ?? []) as AssetScenario[];
}
