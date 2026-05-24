'use server';

import { createServiceClient } from '@/lib/supabase/service';
import { withAudit } from '@/lib/actions/_base';
import type { ActionResult } from '@/lib/actions/_base';
import { AddAssetFileSchema } from '@/lib/schemas/asset-file';
import type { AssetFile } from '@/lib/schemas/asset-file';
import { revalidatePath } from 'next/cache';
import { authorizeCmWrite } from '@/lib/rbac';

const CM_FORBIDDEN = 'Forbidden — capital-markets access required' as const;

function extractTitleFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const segments = pathname.split('/').filter(Boolean);
    const last = segments[segments.length - 1];
    const decoded = decodeURIComponent(last ?? '');
    return decoded || 'Untitled File';
  } catch {
    return 'Untitled File';
  }
}

export async function addAssetFile(
  assetId: string,
  url: string,
  title?: string,
): Promise<ActionResult<AssetFile>> {
  const member = await authorizeCmWrite();
  if (!member) return { ok: false, error: CM_FORBIDDEN };

  const parsed = AddAssetFileSchema.safeParse({ assetId, url, title });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const resolvedTitle = title?.trim() || extractTitleFromUrl(url);

  const result = await withAudit({
    action: 'update',
    entityType: 'asset',
    entityId: assetId,
    assetId,
    summary: `File attached: "${resolvedTitle}"`,
    mutation: async (actorId) => {
      const service = createServiceClient();

      const { data: existing } = await service
        .from('asset_files')
        .select('sort_order')
        .eq('asset_id', assetId)
        .is('deleted_at', null)
        .order('sort_order', { ascending: false })
        .limit(1);

      const nextOrder = ((existing?.[0]?.sort_order) ?? -1) + 1;

      const { data, error } = await service
        .from('asset_files')
        .insert({ asset_id: assetId, url, title: resolvedTitle, sort_order: nextOrder, created_by: actorId })
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data as AssetFile;
    },
  });

  if (result.ok) revalidatePath(`/capital-markets/assets/${assetId}`);
  return result;
}

export async function removeAssetFile(
  fileId: string,
  assetId: string,
): Promise<ActionResult<void>> {
  const member = await authorizeCmWrite();
  if (!member) return { ok: false, error: CM_FORBIDDEN };

  const result = await withAudit({
    action: 'update',
    entityType: 'asset',
    entityId: assetId,
    assetId,
    summary: 'File attachment removed',
    mutation: async (actorId) => {
      const service = createServiceClient();
      const { error } = await service
        .from('asset_files')
        .update({ deleted_at: new Date().toISOString(), deleted_by: actorId })
        .eq('id', fileId);
      if (error) throw new Error(error.message);
    },
  });

  if (result.ok) revalidatePath(`/capital-markets/assets/${assetId}`);
  return result;
}

export async function updateAssetFileTitle(
  fileId: string,
  title: string,
  assetId: string,
): Promise<ActionResult<void>> {
  const member = await authorizeCmWrite();
  if (!member) return { ok: false, error: CM_FORBIDDEN };

  if (!title.trim()) return { ok: false, error: 'Title cannot be empty' };

  const result = await withAudit({
    action: 'update',
    entityType: 'asset',
    entityId: assetId,
    assetId,
    summary: `File renamed to "${title.trim()}"`,
    mutation: async () => {
      const service = createServiceClient();
      const { error } = await service
        .from('asset_files')
        .update({ title: title.trim() })
        .eq('id', fileId);
      if (error) throw new Error(error.message);
    },
  });

  if (result.ok) revalidatePath(`/capital-markets/assets/${assetId}`);
  return result;
}

export async function reorderAssetFiles(
  orderedIds: string[],
  assetId: string,
): Promise<ActionResult<void>> {
  const member = await authorizeCmWrite();
  if (!member) return { ok: false, error: CM_FORBIDDEN };

  const result = await withAudit({
    action: 'update',
    entityType: 'asset',
    entityId: assetId,
    assetId,
    summary: 'File attachments reordered',
    mutation: async () => {
      const service = createServiceClient();
      await Promise.all(
        orderedIds.map((id, index) =>
          service.from('asset_files').update({ sort_order: index }).eq('id', id),
        ),
      );
    },
  });

  return result;
}
