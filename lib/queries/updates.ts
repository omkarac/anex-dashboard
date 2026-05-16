import { createServiceClient } from '@/lib/supabase/service';
import type { AssetStatus, AssetTemperature } from '@/lib/schemas/asset';

export type UpdateWithAuthor = {
  id: string;
  asset_id: string;
  body: string;
  update_date: string | null;
  update_task: string | null;
  comment: string | null;
  created_at: string;
  created_by: string;
  deleted_at: string | null;
  deleted_by: string | null;
  author: { full_name: string } | null;
};

export type StatusHistoryEntry = {
  id: string;
  asset_id: string;
  from_status: AssetStatus | null;
  to_status: AssetStatus;
  from_temperature: AssetTemperature | null;
  to_temperature: AssetTemperature | null;
  note: string | null;
  changed_by: string;
  changed_at: string;
  actor: { full_name: string } | null;
};

export type ActivityLogEntry = {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  summary: string;
  created_at: string;
  deleted_at: string | null;
  actor: { full_name: string } | null;
};

export async function getUpdatesForAsset(assetId: string): Promise<UpdateWithAuthor[]> {
  const service = createServiceClient();
  const { data, error } = await service
    .from('updates')
    .select('*, author:team_members!created_by(full_name)')
    .eq('asset_id', assetId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) return [];
  return (data ?? []) as UpdateWithAuthor[];
}

export async function getStatusHistoryForAsset(assetId: string): Promise<StatusHistoryEntry[]> {
  const service = createServiceClient();
  const { data, error } = await service
    .from('status_history')
    .select('*, actor:team_members!changed_by(full_name)')
    .eq('asset_id', assetId)
    .order('changed_at', { ascending: false });

  if (error) return [];
  return (data ?? []) as StatusHistoryEntry[];
}

export async function getActivityLogsForAsset(assetId: string): Promise<ActivityLogEntry[]> {
  const service = createServiceClient();
  const { data, error } = await service
    .from('activity_logs')
    .select('*, actor:team_members!actor_id(full_name)')
    .eq('entity_id', assetId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return [];
  return (data ?? []) as ActivityLogEntry[];
}
