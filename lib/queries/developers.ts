import { createServiceClient } from '@/lib/supabase/service';
import type { Developer } from '@/lib/schemas/developer';

export type DeveloperShareFull = {
  id: string;
  asset_id: string;
  asset_name: string;
  shared_at: string;
  shared_by_name: string;
  outcome: string | null;
  outcome_at: string | null;
  notes: string | null;
};

export type DeveloperWithStats = Developer & {
  share_count: number;
  last_shared_at: string | null;
  outcome_counts: Record<string, number>;
  shares: DeveloperShareFull[];
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
  const service = createServiceClient();

  const [{ data: devs }, { data: rawShares }] = await Promise.all([
    service.from('developers').select('*').eq('is_active', true).order('name'),
    service.from('developer_shares')
      .select('*, asset:assets!asset_id(property_name)')
      .is('deleted_at', null)
      .order('shared_at', { ascending: false }),
  ]);

  if (!devs?.length) return [];

  const actorIds = [...new Set((rawShares ?? []).map((s) => s.shared_by))];
  const { data: members } = actorIds.length
    ? await service.from('team_members').select('id, full_name').in('id', actorIds)
    : { data: [] };
  const memberMap = new Map((members ?? []).map((m) => [m.id, m.full_name]));

  const sharesByDev = new Map<string, DeveloperShareFull[]>();
  for (const s of rawShares ?? []) {
    const share: DeveloperShareFull = {
      id: s.id,
      asset_id: s.asset_id,
      asset_name: (s.asset as { property_name: string } | null)?.property_name ?? 'Unknown',
      shared_at: s.shared_at,
      shared_by_name: memberMap.get(s.shared_by) ?? 'Unknown',
      outcome: s.outcome,
      outcome_at: s.outcome_at ?? null,
      notes: s.notes,
    };
    const arr = sharesByDev.get(s.developer_id) ?? [];
    arr.push(share);
    sharesByDev.set(s.developer_id, arr);
  }

  return devs.map((d) => {
    const shares = sharesByDev.get(d.id) ?? [];
    const outcome_counts: Record<string, number> = {};
    for (const s of shares) {
      const key = s.outcome ?? 'pending';
      outcome_counts[key] = (outcome_counts[key] ?? 0) + 1;
    }
    return {
      ...(d as Developer),
      share_count: shares.length,
      last_shared_at: shares[0]?.shared_at ?? null,
      outcome_counts,
      shares,
    };
  });
}

export async function listAllShares(): Promise<ShareWithDetails[]> {
  const service = createServiceClient();

  const { data: shares } = await service
    .from('developer_shares')
    .select('*')
    .is('deleted_at', null)
    .order('shared_at', { ascending: false });

  if (!shares?.length) return [];

  const devIds = [...new Set(shares.map((s) => s.developer_id))];
  const actorIds = [...new Set(shares.map((s) => s.shared_by))];
  const assetIds = [...new Set(shares.map((s) => s.asset_id))];

  const [{ data: devs }, { data: members }, { data: assets }] = await Promise.all([
    service.from('developers').select('id, name').in('id', devIds),
    service.from('team_members').select('id, full_name').in('id', actorIds),
    service.from('assets').select('id, property_name').in('id', assetIds),
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
  const service = createServiceClient();

  const { data: shares } = await service
    .from('developer_shares')
    .select('*')
    .eq('asset_id', assetId)
    .is('deleted_at', null)
    .order('shared_at', { ascending: false });

  if (!shares?.length) return [];

  const devIds = [...new Set(shares.map((s) => s.developer_id))];
  const actorIds = [...new Set(shares.map((s) => s.shared_by))];

  const [{ data: devs }, { data: members }] = await Promise.all([
    service.from('developers').select('id, name').in('id', devIds),
    service.from('team_members').select('id, full_name').in('id', actorIds),
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

export async function getDeveloperById(id: string): Promise<DeveloperWithStats | null> {
  const service = createServiceClient();

  const { data: dev } = await service
    .from('developers')
    .select('*')
    .eq('id', id)
    .eq('is_active', true)
    .single();

  if (!dev) return null;

  const { data: rawShares } = await service
    .from('developer_shares')
    .select('*, asset:assets!asset_id(property_name)')
    .eq('developer_id', id)
    .is('deleted_at', null)
    .order('shared_at', { ascending: false });

  const actorIds = [...new Set((rawShares ?? []).map((s) => s.shared_by))];
  const { data: members } = actorIds.length
    ? await service.from('team_members').select('id, full_name').in('id', actorIds)
    : { data: [] };
  const memberMap = new Map((members ?? []).map((m) => [m.id, m.full_name]));

  const shares: DeveloperShareFull[] = (rawShares ?? []).map((s) => ({
    id: s.id,
    asset_id: s.asset_id,
    asset_name: (s.asset as { property_name: string } | null)?.property_name ?? 'Unknown',
    shared_at: s.shared_at,
    shared_by_name: memberMap.get(s.shared_by) ?? 'Unknown',
    outcome: s.outcome,
    outcome_at: s.outcome_at ?? null,
    notes: s.notes,
  }));

  const outcome_counts: Record<string, number> = {};
  for (const s of shares) {
    const key = s.outcome ?? 'pending';
    outcome_counts[key] = (outcome_counts[key] ?? 0) + 1;
  }

  return {
    ...(dev as import('@/lib/schemas/developer').Developer),
    share_count: shares.length,
    last_shared_at: shares[0]?.shared_at ?? null,
    outcome_counts,
    shares,
  };
}

export type DeveloperOption = { id: string; name: string };

export async function getDeveloperOptions(): Promise<DeveloperOption[]> {
  const service = createServiceClient();
  const { data } = await service
    .from('developers')
    .select('id, name')
    .eq('is_active', true)
    .order('name');
  return (data ?? []) as DeveloperOption[];
}
