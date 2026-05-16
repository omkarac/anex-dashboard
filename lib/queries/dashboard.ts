import { createServiceClient } from '@/lib/supabase/service';
import type { AssetStatus, AssetTemperature } from '@/lib/schemas/asset';

// ─── Totals ───────────────────────────────────────────────────────────────────

export type DashboardTotals = {
  total: number;
  active: number;
  screenedThisMonth: number;
  wonThisQuarter: number;
};

export async function getDashboardTotals(): Promise<DashboardTotals> {
  const service = createServiceClient();

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const quarter = Math.floor(now.getMonth() / 3);
  const startOfQuarter = new Date(now.getFullYear(), quarter * 3, 1).toISOString();

  const [totalRes, activeRes, screenedRes, wonRes] = await Promise.all([
    service
      .from('assets')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null),
    service
      .from('assets')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null)
      .not('status', 'in', '("dropped","won")'),
    service
      .from('status_history')
      .select('asset_id', { count: 'exact', head: true })
      .eq('to_status', 'screened')
      .gte('changed_at', startOfMonth),
    service
      .from('status_history')
      .select('asset_id', { count: 'exact', head: true })
      .eq('to_status', 'won')
      .gte('changed_at', startOfQuarter),
  ]);

  return {
    total: totalRes.count ?? 0,
    active: activeRes.count ?? 0,
    screenedThisMonth: screenedRes.count ?? 0,
    wonThisQuarter: wonRes.count ?? 0,
  };
}

// ─── Pipeline by status ───────────────────────────────────────────────────────

export type StatusCount = { status: AssetStatus; count: number };

export async function getPipelineCounts(): Promise<StatusCount[]> {
  const service = createServiceClient();
  const { data } = await service
    .from('assets')
    .select('status')
    .is('deleted_at', null);

  if (!data) return [];
  const map = new Map<string, number>();
  for (const row of data) {
    map.set(row.status, (map.get(row.status) ?? 0) + 1);
  }
  return Array.from(map.entries()).map(([status, count]) => ({
    status: status as AssetStatus,
    count,
  }));
}

// ─── Temperature breakdown ────────────────────────────────────────────────────

export type TempCount = { temperature: AssetTemperature; count: number };

export async function getTemperatureCounts(): Promise<TempCount[]> {
  const service = createServiceClient();
  const { data } = await service
    .from('assets')
    .select('temperature')
    .is('deleted_at', null)
    .not('status', 'in', '("dropped","won")');

  if (!data) return [];
  const map = new Map<string, number>();
  for (const row of data) {
    map.set(row.temperature, (map.get(row.temperature) ?? 0) + 1);
  }
  return Array.from(map.entries()).map(([temperature, count]) => ({
    temperature: temperature as AssetTemperature,
    count,
  }));
}

// ─── Developer shares ─────────────────────────────────────────────────────────

export type DeveloperShareStat = {
  developer_id: string;
  developer_name: string;
  share_count: number;
};

export async function getDeveloperShareStats(): Promise<{
  totalShares: number;
  top5: DeveloperShareStat[];
}> {
  const service = createServiceClient();

  const { data: shares, count } = await service
    .from('developer_shares')
    .select('developer_id', { count: 'exact' });

  if (!shares) return { totalShares: 0, top5: [] };

  const countMap = new Map<string, number>();
  for (const s of shares) {
    countMap.set(s.developer_id, (countMap.get(s.developer_id) ?? 0) + 1);
  }

  const sorted = Array.from(countMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (sorted.length === 0) return { totalShares: count ?? 0, top5: [] };

  const devIds = sorted.map(([id]) => id);
  const { data: devs } = await service
    .from('developers')
    .select('id, name')
    .in('id', devIds);

  const devMap = new Map((devs ?? []).map((d) => [d.id, d.name]));

  return {
    totalShares: count ?? 0,
    top5: sorted.map(([id, share_count]) => ({
      developer_id: id,
      developer_name: devMap.get(id) ?? 'Unknown',
      share_count,
    })),
  };
}

// ─── Team workload ────────────────────────────────────────────────────────────

export type MemberWorkload = {
  member_id: string;
  full_name: string;
  open_tasks: number;
  spoc_assets: number;
};

export async function getTeamWorkload(): Promise<MemberWorkload[]> {
  const service = createServiceClient();

  const [{ data: members }, { data: tasks }, { data: assets }] = await Promise.all([
    service.from('team_members').select('id, full_name').eq('is_active', true).order('full_name'),
    service
      .from('tasks')
      .select('assigned_to')
      .is('deleted_at', null)
      .not('status', 'in', '("done","cancelled")')
      .not('assigned_to', 'is', null),
    service
      .from('assets')
      .select('spoc_agent')
      .is('deleted_at', null)
      .not('status', 'in', '("dropped","won")')
      .not('spoc_agent', 'is', null),
  ]);

  if (!members) return [];

  const taskMap = new Map<string, number>();
  for (const t of tasks ?? []) {
    taskMap.set(t.assigned_to, (taskMap.get(t.assigned_to) ?? 0) + 1);
  }

  const spocMap = new Map<string, number>();
  for (const a of assets ?? []) {
    const name = (a.spoc_agent as string).toLowerCase().trim();
    spocMap.set(name, (spocMap.get(name) ?? 0) + 1);
  }

  return members.map((m) => ({
    member_id: m.id,
    full_name: m.full_name,
    open_tasks: taskMap.get(m.id) ?? 0,
    spoc_assets: spocMap.get(m.full_name.toLowerCase().trim()) ?? 0,
  }));
}

// ─── Recent activity ──────────────────────────────────────────────────────────

export type RecentLog = {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  summary: string;
  created_at: string;
  actor: { full_name: string } | null;
};

export async function getRecentActivity(): Promise<RecentLog[]> {
  const service = createServiceClient();

  const { data } = await service
    .from('activity_logs')
    .select('id, actor_id, action, entity_type, entity_id, summary, created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(10);

  if (!data || data.length === 0) return [];

  const actorIds = [...new Set(data.map((r) => r.actor_id).filter(Boolean))] as string[];
  const { data: members } = await service
    .from('team_members')
    .select('id, full_name')
    .in('id', actorIds);

  const memberMap = new Map((members ?? []).map((m) => [m.id, m.full_name]));

  return data.map((r) => ({
    ...r,
    actor: r.actor_id ? { full_name: memberMap.get(r.actor_id) ?? 'Unknown' } : null,
  }));
}
