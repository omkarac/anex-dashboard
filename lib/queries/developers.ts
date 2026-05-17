import { createServiceClient } from '@/lib/supabase/service';
import type { Developer, DeveloperPreferences } from '@/lib/schemas/developer';

export type ShareTask = {
  id: string;
  share_id: string;
  title: string;
  task_type: string | null;
  status: string;
  priority: string;
  assigned_to: string | null;
  assigned_to_name: string | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
};

export type ShareUpdate = {
  id: string;
  share_id: string;
  body: string;
  source: string;
  task_id: string | null;
  created_at: string;
  created_by: string;
  created_by_name: string;
};

export type DeveloperShareFull = {
  id: string;
  asset_id: string;
  asset_name: string;
  asset_micro_market: string | null;
  shared_at: string;
  shared_by_name: string;
  outcome: string | null;
  outcome_at: string | null;
  notes: string | null;
  tasks: ShareTask[];
  updates: ShareUpdate[];
};

export type DeveloperWithStats = Developer & {
  share_count: number;
  last_shared_at: string | null;
  outcome_counts: Record<string, number>;
  shares: DeveloperShareFull[];
  preferences: DeveloperPreferences | null;
  sharedMarkets: string[];
  interestedMarkets: string[];
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
      asset_micro_market: null,
      shared_at: s.shared_at,
      shared_by_name: memberMap.get(s.shared_by) ?? 'Unknown',
      outcome: s.outcome,
      outcome_at: s.outcome_at ?? null,
      notes: s.notes,
      tasks: [],
      updates: [],
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
      preferences: null,
      sharedMarkets: [],
      interestedMarkets: [],
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

  const [{ data: rawShares }, { data: prefs }] = await Promise.all([
    service
      .from('developer_shares')
      .select('*, asset:assets!asset_id(property_name, micro_market)')
      .eq('developer_id', id)
      .is('deleted_at', null)
      .order('shared_at', { ascending: false }),
    service
      .from('developer_preferences')
      .select('*')
      .eq('developer_id', id)
      .maybeSingle(),
  ]);

  const shareIds = (rawShares ?? []).map((s) => s.id);

  // Fetch tasks and updates for all shares in parallel
  const [{ data: rawTasks }, { data: rawUpdates }] = shareIds.length
    ? await Promise.all([
        service
          .from('share_tasks')
          .select('*')
          .in('share_id', shareIds)
          .is('deleted_at', null)
          .order('created_at'),
        service
          .from('share_updates')
          .select('*')
          .in('share_id', shareIds)
          .is('deleted_at', null)
          .order('created_at'),
      ])
    : ([{ data: [] }, { data: [] }] as const);

  // Collect all member IDs needed for display names
  const memberIdSet = new Set<string>();
  for (const s of rawShares ?? []) memberIdSet.add(s.shared_by);
  for (const t of rawTasks ?? []) if (t.assigned_to) memberIdSet.add(t.assigned_to);
  for (const u of rawUpdates ?? []) memberIdSet.add(u.created_by);

  const { data: members } = memberIdSet.size
    ? await service.from('team_members').select('id, full_name').in('id', [...memberIdSet])
    : { data: [] };
  const memberMap = new Map((members ?? []).map((m) => [m.id, m.full_name]));

  // Group tasks by share
  const tasksByShare = new Map<string, ShareTask[]>();
  for (const t of rawTasks ?? []) {
    const arr = tasksByShare.get(t.share_id) ?? [];
    arr.push({
      id: t.id,
      share_id: t.share_id,
      title: t.title,
      task_type: t.task_type ?? null,
      status: t.status,
      priority: t.priority,
      assigned_to: t.assigned_to ?? null,
      assigned_to_name: t.assigned_to ? (memberMap.get(t.assigned_to) ?? null) : null,
      due_date: t.due_date ?? null,
      completed_at: t.completed_at ?? null,
      created_at: t.created_at,
    });
    tasksByShare.set(t.share_id, arr);
  }

  // Group updates by share
  const updatesByShare = new Map<string, ShareUpdate[]>();
  for (const u of rawUpdates ?? []) {
    const arr = updatesByShare.get(u.share_id) ?? [];
    arr.push({
      id: u.id,
      share_id: u.share_id,
      body: u.body,
      source: u.source,
      task_id: u.task_id ?? null,
      created_at: u.created_at,
      created_by: u.created_by,
      created_by_name: memberMap.get(u.created_by) ?? 'Unknown',
    });
    updatesByShare.set(u.share_id, arr);
  }

  type AssetJoin = { property_name: string; micro_market: string | null } | null;

  const shares: DeveloperShareFull[] = (rawShares ?? []).map((s) => {
    const asset = s.asset as AssetJoin;
    return {
      id: s.id,
      asset_id: s.asset_id,
      asset_name: asset?.property_name ?? 'Unknown',
      asset_micro_market: asset?.micro_market ?? null,
      shared_at: s.shared_at,
      shared_by_name: memberMap.get(s.shared_by) ?? 'Unknown',
      outcome: s.outcome,
      outcome_at: s.outcome_at ?? null,
      notes: s.notes,
      tasks: tasksByShare.get(s.id) ?? [],
      updates: updatesByShare.get(s.id) ?? [],
    };
  });

  const outcome_counts: Record<string, number> = {};
  for (const s of shares) {
    const key = s.outcome ?? 'pending';
    outcome_counts[key] = (outcome_counts[key] ?? 0) + 1;
  }

  const INTERESTED_OUTCOMES = new Set(['interested', 'pursuing', 'won']);

  const sharedMarkets = [
    ...new Set(shares.map((s) => s.asset_micro_market).filter((m): m is string => m != null)),
  ];

  const interestedMarkets = [
    ...new Set(
      shares
        .filter((s) => s.outcome != null && INTERESTED_OUTCOMES.has(s.outcome))
        .map((s) => s.asset_micro_market)
        .filter((m): m is string => m != null)
    ),
  ];

  return {
    ...(dev as Developer),
    share_count: shares.length,
    last_shared_at: shares[0]?.shared_at ?? null,
    outcome_counts,
    shares,
    preferences: (prefs as DeveloperPreferences | null) ?? null,
    sharedMarkets,
    interestedMarkets,
  };
}

export type UnassignedTask = {
  id: string;
  share_id: string;
  title: string;
  task_type: string | null;
  developer_id: string;
  developer_name: string;
  asset_id: string;
  asset_name: string;
};

export async function getUnassignedTasks(): Promise<UnassignedTask[]> {
  const service = createServiceClient();

  const { data: tasks } = await service
    .from('share_tasks')
    .select('id, share_id, title, task_type')
    .eq('status', 'todo')
    .is('assigned_to', null)
    .is('deleted_at', null)
    .order('created_at');

  if (!tasks?.length) return [];

  const shareIds = [...new Set(tasks.map((t) => t.share_id))];
  const { data: shares } = await service
    .from('developer_shares')
    .select('id, developer_id, asset_id')
    .in('id', shareIds)
    .is('deleted_at', null);

  if (!shares?.length) return [];

  const devIds = [...new Set(shares.map((s) => s.developer_id))];
  const assetIds = [...new Set(shares.map((s) => s.asset_id))];

  const [{ data: devs }, { data: assets }] = await Promise.all([
    service.from('developers').select('id, name').in('id', devIds),
    service.from('assets').select('id, property_name').in('id', assetIds),
  ]);

  const shareMap = new Map(shares.map((s) => [s.id, s]));
  const devMap = new Map((devs ?? []).map((d) => [d.id, d.name]));
  const assetMap = new Map((assets ?? []).map((a) => [a.id, a.property_name]));

  return tasks.flatMap((t) => {
    const share = shareMap.get(t.share_id);
    if (!share) return [];
    return [{
      id: t.id,
      share_id: t.share_id,
      title: t.title,
      task_type: t.task_type ?? null,
      developer_id: share.developer_id,
      developer_name: devMap.get(share.developer_id) ?? 'Unknown',
      asset_id: share.asset_id,
      asset_name: assetMap.get(share.asset_id) ?? 'Unknown',
    }];
  });
}

export type AssetOpenTask = {
  id: string;
  asset_id: string;
  title: string;
  priority: string;
  status: string;
  due_date: string | null;
};

export async function getOpenTasksForAssets(assetIds: string[]): Promise<AssetOpenTask[]> {
  if (!assetIds.length) return [];
  const service = createServiceClient();

  const { data: shares } = await service
    .from('developer_shares')
    .select('id, asset_id')
    .in('asset_id', assetIds)
    .is('deleted_at', null);

  if (!shares?.length) return [];

  const shareIds = shares.map((s) => s.id);
  const shareAssetMap = new Map(shares.map((s) => [s.id, s.asset_id]));

  const { data: tasks } = await service
    .from('share_tasks')
    .select('id, share_id, title, priority, status, due_date')
    .in('share_id', shareIds)
    .neq('status', 'done')
    .is('deleted_at', null)
    .order('created_at');

  if (!tasks?.length) return [];

  return tasks.flatMap((t) => {
    const assetId = shareAssetMap.get(t.share_id);
    if (!assetId) return [];
    return [{ id: t.id, asset_id: assetId, title: t.title, priority: t.priority, status: t.status, due_date: t.due_date ?? null }];
  });
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
