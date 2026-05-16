import { createServiceClient } from '@/lib/supabase/service';
import type { AssetFile } from '@/lib/schemas/asset-file';

export async function getFilesForAsset(assetId: string): Promise<AssetFile[]> {
  const service = createServiceClient();
  const { data } = await service
    .from('asset_files')
    .select('*')
    .eq('asset_id', assetId)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  return (data ?? []) as AssetFile[];
}
