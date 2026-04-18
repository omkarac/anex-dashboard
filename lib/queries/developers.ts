import { createClient } from '@/lib/supabase/server';
import type { Developer } from '@/lib/schemas/developer';

export type DeveloperWithStats = Developer & {
  active_shares: number;
  last_shared_at: string | null;
};

export type ShareWithDetails = {
  id: string;
  asset_id: string;
  asset_name: string;
  developer_id: string;
  developer_name: string;
  shared_at: string;
  shared_by: string;
  shared_by_name: string;
  outcome: string | null;
  notes: string | null;
};

export async function listDevelopers(): Promise<DeveloperWithStats[]> {
  const supabase = await createClient();

  const { data: devs } = await supabase
    .from('developers')
    .select('*')
    .eq('is_active', true)
    .order('name');

  if (!devs?.length) return [];

  const { data: shares } = await supabase
    .from('developer_shares')
    .select('developer_id, shared_at')
    .is('deleted_at', null);

  const sharesByDev: Record<string, string[]> = {};
  for (const s of shares ?? []) {
    if (!sharesByDev[s.developer_id]) sharesByDev[s.developer_id] = [];
    sharesByDev[s.developer_id].push(s.shared_at);
  }

  return devs.map((d) => {
    const dates = sharesByDev[d.id] ?? [];
    return {
      ...(d as Developer),
      active_shares: dates.length,
      last_shared_at: dates.length > 0 ? dates.sort().at(-1)! : null,
    };
  });
}

export async function listAllShares(): Promise<ShareWithDetails[]> {
  const supabase = await createClient();

  const { data: shares } = await supabase
    .from('developer_shares')
    .select('*')
    .is('deleted_at', null)
    .order('shared_at', { ascending: false });

  if (!shares?.length) return [];

  const devIds = [...new Set(shares.map((s) => s.developer_id))];
  const actorIds = [...new Set(shares.map((s) => s.shared_by))];
  const assetIds = [...new Set(shares.map((s) => s.asset_id))];

  const [{ data: devs }, { data: members }, { data: assets }] = await Promise.all([
    supabase.from('developers').select('id, name').in('id', devIds),
    supabase.from('team_members').select('id, full_name').in('id', actorIds),
    supabase.from('assets').select('id, property_name').in('id', assetIds),
  ]);

  const devMap = Object.fromEntries((devs ?? []).map((d) => [d.id, d.name]));
  const memberMap = Object.fromEntries((members ?? []).map((m) => [m.id, m.full_name]));
  const assetMap = Object.fromEntries((assets ?? []).map((a) => [a.id, a.property_name]));

  return shares.map((s) => ({
    id: s.id,
    asset_id: s.asset_id,
    asset_name: assetMap[s.asset_id] ?? 'Unknown',
    developer_id: s.developer_id,
    developer_name: devMap[s.developer_id] ?? 'Unknown',
    shared_at: s.shared_at,
    shared_by: s.shared_by,
    shared_by_name: memberMap[s.shared_by] ?? 'Unknown',
    outcome: s.outcome,
    notes: s.notes,
  }));
}

export async function getSharesForAsset(assetId: string): Promise<ShareWithDetails[]> {
  const supabase = await createClient();

  const { data: shares } = await supabase
    .from('developer_shares')
    .select('*')
    .eq('asset_id', assetId)
    .is('deleted_at', null)
    .order('shared_at', { ascending: false });

  if (!shares?.length) return [];

  const devIds = [...new Set(shares.map((s) => s.developer_id))];
  const actorIds = [...new Set(shares.map((s) => s.shared_by))];

  const [{ data: devs }, { data: members }] = await Promise.all([
    supabase.from('developers').select('id, name').in('id', devIds),
    supabase.from('team_members').select('id, full_name').in('id', actorIds),
  ]);

  const devMap = Object.fromEntries((devs ?? []).map((d) => [d.id, d.name]));
  const memberMap = Object.fromEntries((members ?? []).map((m) => [m.id, m.full_name]));

  return shares.map((s) => ({
    id: s.id,
    asset_id: s.asset_id,
    asset_name: '',
    developer_id: s.developer_id,
    developer_name: devMap[s.developer_id] ?? 'Unknown',
    shared_at: s.shared_at,
    shared_by: s.shared_by,
    shared_by_name: memberMap[s.shared_by] ?? 'Unknown',
    outcome: s.outcome,
    notes: s.notes,
  }));
}

export type DeveloperOption = { id: string; name: string };

export async function getDeveloperOptions(): Promise<DeveloperOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('developers')
    .select('id, name')
    .eq('is_active', true)
    .order('name');
  return (data ?? []) as DeveloperOption[];
}
