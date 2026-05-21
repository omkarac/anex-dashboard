import { createServiceClient } from '@/lib/supabase/service';
import {
  CM_ENTITY_TYPES,
  SM_ENTITY_TYPES,
  verticalForEntity,
  type AuditVertical,
  type LogFilters,
} from '@/lib/queries/logs';

const ANALYTICS_ROW_CAP = 5000;
const FLAGGED_ROW_CAP = 400;
// After-hours = activity outside business hours in IST (UTC+5:30): from
// 10:00 PM IST through 6:00 AM IST. Timestamps are stored in UTC, so we shift
// by the IST offset and compare minutes-of-day to respect the :30 offset.
const IST_OFFSET_MINUTES = 330;
const AFTER_HOURS_START_MIN = 22 * 60; // 10:00 PM IST
const AFTER_HOURS_END_MIN = 6 * 60; // 6:00 AM IST

type RawRow = {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  summary: string;
  created_at: string;
  deleted_at: string | null;
};

// Fetch scoped rows using the same filter rules as listLogs so analytics
// matches the table. Chains directly on the PostgREST builder.
async function fetchScopedRows(filters: LogFilters, cap: number): Promise<RawRow[]> {
  const service = createServiceClient();
  let q = service
    .from('activity_logs')
    .select('id, actor_id, action, entity_type, summary, created_at, deleted_at');

  if (!filters.show_deleted) q = q.is('deleted_at', null);
  if (filters.q) q = q.ilike('summary', `%${filters.q}%`);
  if (filters.actor_id) q = q.eq('actor_id', filters.actor_id);
  if (filters.action) q = q.eq('action', filters.action);
  if (filters.entity_type) q = q.eq('entity_type', filters.entity_type);
  if (filters.from) q = q.gte('created_at', filters.from);
  if (filters.to) q = q.lte('created_at', filters.to + 'T23:59:59Z');
  if (filters.vertical === 'capital_markets') {
    q = q.in('entity_type', CM_ENTITY_TYPES);
  } else if (filters.vertical === 'sales_marketing') {
    q = q.in('entity_type', SM_ENTITY_TYPES);
  }

  const { data } = await q.order('created_at', { ascending: false }).limit(cap);
  return (data ?? []) as RawRow[];
}

export type AuditStats = {
  today: number;
  last7: number;
  totalInView: number;
  activeUsers: number;
  deletions: number;
  topEntity: { type: string; count: number } | null;
};

export type TimeBucket = { date: string; count: number };
export type ActionCount = { action: string; count: number };
export type ActorCount = { actor_id: string; full_name: string; count: number };

export type AuditAnalytics = {
  timeSeries: TimeBucket[];
  actions: ActionCount[];
  leaderboard: ActorCount[];
  totalEvents: number;
};

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

export async function getAuditStats(filters: LogFilters = {}): Promise<AuditStats> {
  const rows = await fetchScopedRows(filters, ANALYTICS_ROW_CAP);

  const now = new Date();
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  let today = 0;
  let last7 = 0;
  let deletions = 0;
  const actors = new Set<string>();
  const entityCounts = new Map<string, number>();

  for (const r of rows) {
    if (r.created_at >= startOfToday) today += 1;
    if (r.created_at >= sevenDaysAgo) last7 += 1;
    if (r.action === 'delete' || r.action === 'delete_log') deletions += 1;
    if (r.actor_id) actors.add(r.actor_id);
    entityCounts.set(r.entity_type, (entityCounts.get(r.entity_type) ?? 0) + 1);
  }

  let topEntity: AuditStats['topEntity'] = null;
  for (const [type, count] of entityCounts) {
    if (!topEntity || count > topEntity.count) topEntity = { type, count };
  }

  return {
    today,
    last7,
    totalInView: rows.length,
    activeUsers: actors.size,
    deletions,
    topEntity,
  };
}

export async function getAuditAnalytics(filters: LogFilters = {}): Promise<AuditAnalytics> {
  const rows = await fetchScopedRows(filters, ANALYTICS_ROW_CAP);

  const dayCounts = new Map<string, number>();
  const actionCounts = new Map<string, number>();
  const actorCounts = new Map<string, number>();

  for (const r of rows) {
    dayCounts.set(dayKey(r.created_at), (dayCounts.get(dayKey(r.created_at)) ?? 0) + 1);
    actionCounts.set(r.action, (actionCounts.get(r.action) ?? 0) + 1);
    if (r.actor_id) actorCounts.set(r.actor_id, (actorCounts.get(r.actor_id) ?? 0) + 1);
  }

  // Build a continuous 14-day window so the chart has no gaps.
  const timeSeries: TimeBucket[] = [];
  const today = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    timeSeries.push({ date: key, count: dayCounts.get(key) ?? 0 });
  }

  const actions: ActionCount[] = [...actionCounts.entries()]
    .map(([action, count]) => ({ action, count }))
    .sort((a, b) => b.count - a.count);

  // Resolve actor names for the leaderboard.
  const topActorIds = [...actorCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([id]) => id);

  let nameMap = new Map<string, string>();
  if (topActorIds.length) {
    const service = createServiceClient();
    const { data: members } = await service
      .from('team_members')
      .select('id, full_name')
      .in('id', topActorIds);
    nameMap = new Map((members ?? []).map((m) => [m.id, m.full_name]));
  }

  const leaderboard: ActorCount[] = topActorIds.map((id) => ({
    actor_id: id,
    full_name: nameMap.get(id) ?? 'Unknown',
    count: actorCounts.get(id) ?? 0,
  }));

  return { timeSeries, actions, leaderboard, totalEvents: rows.length };
}

export type FlagKind = 'deletion' | 'status_reversal' | 'after_hours' | 'bulk';

export type FlaggedEvent = {
  id: string;
  actor_id: string | null;
  actor_name: string;
  action: string;
  entity_type: string;
  summary: string;
  created_at: string;
  flags: FlagKind[];
};

const REVERSAL_HINTS = ['to open', 'to dropped', 'reopen', 'revert', 'rolled back'];

export async function getFlaggedEvents(filters: LogFilters = {}): Promise<FlaggedEvent[]> {
  // Flagging always looks at live (non-deleted) entries.
  const rows = await fetchScopedRows({ ...filters, show_deleted: false }, FLAGGED_ROW_CAP);

  // Detect bulk activity: same actor + action + entity_type within a 60s window.
  const burstKey = (r: RawRow) =>
    `${r.actor_id ?? 'none'}|${r.action}|${r.entity_type}|${r.created_at.slice(0, 16)}`;
  const burstCounts = new Map<string, number>();
  for (const r of rows) burstCounts.set(burstKey(r), (burstCounts.get(burstKey(r)) ?? 0) + 1);

  const flagged: Array<RawRow & { flags: FlagKind[] }> = [];
  for (const r of rows) {
    const flags: FlagKind[] = [];
    if (r.action === 'delete' || r.action === 'delete_log') flags.push('deletion');

    const lower = r.summary.toLowerCase();
    if (r.action === 'status_change' && REVERSAL_HINTS.some((h) => lower.includes(h))) {
      flags.push('status_reversal');
    }

    const d = new Date(r.created_at);
    const istMinutes = (d.getUTCHours() * 60 + d.getUTCMinutes() + IST_OFFSET_MINUTES) % 1440;
    if (istMinutes >= AFTER_HOURS_START_MIN || istMinutes < AFTER_HOURS_END_MIN) flags.push('after_hours');

    if ((burstCounts.get(burstKey(r)) ?? 0) >= 5) flags.push('bulk');

    if (flags.length) flagged.push({ ...r, flags });
  }

  const actorIds = [...new Set(flagged.map((r) => r.actor_id).filter(Boolean))] as string[];
  let nameMap = new Map<string, string>();
  if (actorIds.length) {
    const service = createServiceClient();
    const { data: members } = await service
      .from('team_members')
      .select('id, full_name')
      .in('id', actorIds);
    nameMap = new Map((members ?? []).map((m) => [m.id, m.full_name]));
  }

  return flagged.slice(0, 100).map((r) => ({
    id: r.id,
    actor_id: r.actor_id,
    actor_name: r.actor_id ? nameMap.get(r.actor_id) ?? 'Unknown' : 'System',
    action: r.action,
    entity_type: r.entity_type,
    summary: r.summary,
    created_at: r.created_at,
    flags: r.flags,
  }));
}

export { verticalForEntity };
export type { AuditVertical };
