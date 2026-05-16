import { createServiceClient } from '@/lib/supabase/service';
import type { AssetStatus } from '@/lib/schemas/asset';

// ─── Command stats (headline bar) ────────────────────────────────────────────

export type CommandStats = {
  activePipelineValue: number;
  activeCount: number;
  hotCount: number;
  winRate: number;
  wonCountQ: number;
};

export async function getCommandStats(): Promise<CommandStats> {
  const service = createServiceClient();
  const now = new Date();
  const quarter = Math.floor(now.getMonth() / 3);
  const startOfQuarter = new Date(now.getFullYear(), quarter * 3, 1).toISOString();

  const [activeRes, hotRes, wonRes, droppedRes] = await Promise.all([
    service
      .from('assets')
      .select('topline_cr')
      .is('deleted_at', null)
      .not('status', 'in', '("dropped","won")'),
    service
      .from('assets')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null)
      .eq('temperature', 'hot')
      .not('status', 'in', '("dropped","won")'),
    service
      .from('status_history')
      .select('id', { count: 'exact', head: true })
      .eq('to_status', 'won')
      .gte('changed_at', startOfQuarter),
    service
      .from('status_history')
      .select('id', { count: 'exact', head: true })
      .eq('to_status', 'dropped')
      .gte('changed_at', startOfQuarter),
  ]);

  const assets = activeRes.data ?? [];
  const activePipelineValue = assets.reduce((sum, a) => sum + (Number(a.topline_cr) || 0), 0);
  const activeCount = assets.length;
  const hotCount = hotRes.count ?? 0;
  const wonCountQ = wonRes.count ?? 0;
  const droppedCountQ = droppedRes.count ?? 0;
  const totalClosed = wonCountQ + droppedCountQ;
  const winRate = totalClosed > 0 ? Math.round((wonCountQ / totalClosed) * 100) : 0;

  return { activePipelineValue, activeCount, hotCount, winRate, wonCountQ };
}

// ─── Pipeline with value ──────────────────────────────────────────────────────

export type PipelineStage = {
  status: AssetStatus;
  count: number;
  value: number;
};

const PIPELINE_ORDER: AssetStatus[] = ['open', 'evaluating', 'screened', 'won', 'dropped'];

export async function getPipelineWithValue(): Promise<PipelineStage[]> {
  const service = createServiceClient();
  const { data } = await service
    .from('assets')
    .select('status, topline_cr')
    .is('deleted_at', null);

  if (!data) return [];

  const map = new Map<string, { count: number; value: number }>();
  for (const row of data) {
    const entry = map.get(row.status) ?? { count: 0, value: 0 };
    map.set(row.status, {
      count: entry.count + 1,
      value: entry.value + (Number(row.topline_cr) || 0),
    });
  }

  return PIPELINE_ORDER.map((status) => ({
    status,
    ...(map.get(status) ?? { count: 0, value: 0 }),
  }));
}

// ─── Deal aging (time in current stage) ──────────────────────────────────────

export type DealAging = {
  under7: number;
  d7to30: number;
  d30to60: number;
  over60: number;
};

export async function getDealAging(): Promise<DealAging> {
  const service = createServiceClient();

  const [assetsRes, historyRes] = await Promise.all([
    service
      .from('assets')
      .select('id, created_at')
      .is('deleted_at', null)
      .not('status', 'in', '("dropped","won")'),
    service
      .from('status_history')
      .select('asset_id, changed_at')
      .order('changed_at', { ascending: false }),
  ]);

  const assets = assetsRes.data ?? [];

  const latestMap = new Map<string, string>();
  for (const h of historyRes.data ?? []) {
    if (!latestMap.has(h.asset_id)) latestMap.set(h.asset_id, h.changed_at);
  }

  const now = Date.now();
  const buckets: DealAging = { under7: 0, d7to30: 0, d30to60: 0, over60: 0 };

  for (const asset of assets) {
    const ref = latestMap.get(asset.id) ?? asset.created_at;
    const days = Math.floor((now - new Date(ref).getTime()) / 86_400_000);
    if (days < 7) buckets.under7++;
    else if (days < 30) buckets.d7to30++;
    else if (days < 60) buckets.d30to60++;
    else buckets.over60++;
  }

  return buckets;
}

// ─── Attention signals ────────────────────────────────────────────────────────

export type AttentionSignal = {
  id: string;
  property_name: string;
  status: AssetStatus;
  reason: 'hot_unassigned' | 'hot_silent' | 'stale_stage';
  detail: string;
  severity: 'high' | 'medium';
};

export async function getAttentionSignals(): Promise<AttentionSignal[]> {
  const service = createServiceClient();
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const fortyFiveDaysAgo = new Date(Date.now() - 45 * 86_400_000).toISOString();

  const [assetsRes, recentActivityRes, historyRes] = await Promise.all([
    service
      .from('assets')
      .select('id, property_name, status, temperature, assigned_to')
      .is('deleted_at', null)
      .not('status', 'in', '("dropped","won")'),
    service
      .from('activity_logs')
      .select('entity_id')
      .eq('entity_type', 'asset')
      .gte('created_at', sevenDaysAgo)
      .is('deleted_at', null),
    service
      .from('status_history')
      .select('asset_id, changed_at')
      .order('changed_at', { ascending: false }),
  ]);

  const assets = assetsRes.data ?? [];
  const recentSet = new Set((recentActivityRes.data ?? []).map((r) => r.entity_id));

  const latestMap = new Map<string, string>();
  for (const h of historyRes.data ?? []) {
    if (!latestMap.has(h.asset_id)) latestMap.set(h.asset_id, h.changed_at);
  }

  const signals: AttentionSignal[] = [];

  for (const asset of assets) {
    const lastChange = latestMap.get(asset.id);
    const isStale = lastChange ? lastChange < fortyFiveDaysAgo : false;
    const hasRecentActivity = recentSet.has(asset.id);

    if (asset.temperature === 'hot' && !asset.assigned_to) {
      signals.push({
        id: asset.id,
        property_name: asset.property_name,
        status: asset.status as AssetStatus,
        reason: 'hot_unassigned',
        detail: 'Hot deal — no owner assigned',
        severity: 'high',
      });
    } else if (asset.temperature === 'hot' && !hasRecentActivity) {
      signals.push({
        id: asset.id,
        property_name: asset.property_name,
        status: asset.status as AssetStatus,
        reason: 'hot_silent',
        detail: 'Hot deal — no activity in 7+ days',
        severity: 'high',
      });
    } else if (isStale && (asset.status === 'evaluating' || asset.status === 'screened')) {
      const days = Math.floor((Date.now() - new Date(lastChange!).getTime()) / 86_400_000);
      signals.push({
        id: asset.id,
        property_name: asset.property_name,
        status: asset.status as AssetStatus,
        reason: 'stale_stage',
        detail: `${days}d in ${asset.status}`,
        severity: 'medium',
      });
    }
  }

  return signals
    .sort((a, b) => (a.severity === 'high' && b.severity !== 'high' ? -1 : 1))
    .slice(0, 8);
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
