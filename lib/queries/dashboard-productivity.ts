import { createServiceClient } from '@/lib/supabase/service';
import type { AssetStatus } from '@/lib/schemas/asset';

// ─── Shared helpers ──────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfWeek(d: Date): Date {
  // ISO week: Monday start
  const x = startOfDay(d);
  const day = x.getDay(); // 0=Sun
  const diff = (day + 6) % 7;
  x.setDate(x.getDate() - diff);
  return x;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

// ─── 1. My Day ───────────────────────────────────────────────────────────────

export type MyDayTask = {
  id: string;
  asset_id: string;
  title: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_date: string | null;
  overdue_days: number;
  asset_name: string;
};

export type MyDayAsset = {
  id: string;
  property_name: string;
  status: AssetStatus;
  days_silent: number;
  temperature: string;
};

export type MyDayMove = {
  asset_id: string;
  property_name: string;
  from_status: AssetStatus | null;
  to_status: AssetStatus;
  changed_at: string;
};

export type MyDay = {
  tasks_due: MyDayTask[];
  silent_assets: MyDayAsset[];
  this_week_moves: MyDayMove[];
  updates_today: number;
};

export async function getMyDay(memberId: string): Promise<MyDay> {
  const service = createServiceClient();
  const now = new Date();
  const today = startOfDay(now).toISOString();
  const weekStart = startOfWeek(now).toISOString();
  const fiveDaysAgo = new Date(now.getTime() - 5 * DAY_MS).toISOString();
  const todayDate = startOfDay(now).toISOString().slice(0, 10);

  const [tasksRes, ownedRes, movesRes, updatesTodayRes, assetsForTaskRes] = await Promise.all([
    service
      .from('tasks')
      .select('id, asset_id, title, priority, due_date, status')
      .eq('assigned_to', memberId)
      .is('deleted_at', null)
      .not('status', 'in', '("done","cancelled")')
      .not('due_date', 'is', null)
      .lte('due_date', todayDate)
      .order('due_date', { ascending: true })
      .limit(20),
    service
      .from('assets')
      .select('id, property_name, status, temperature, updated_at, assigned_to, spoc_agent')
      .is('deleted_at', null)
      .not('status', 'in', '("dropped","won")')
      .eq('assigned_to', memberId)
      .order('updated_at', { ascending: true })
      .limit(40),
    service
      .from('status_history')
      .select('asset_id, from_status, to_status, changed_at, assets(property_name)')
      .eq('changed_by', memberId)
      .gte('changed_at', weekStart)
      .order('changed_at', { ascending: false })
      .limit(10),
    service
      .from('updates')
      .select('id', { count: 'exact', head: true })
      .eq('created_by', memberId)
      .gte('created_at', today)
      .is('deleted_at', null),
    service.from('assets').select('id, property_name').is('deleted_at', null),
  ]);

  const assetNameMap = new Map<string, string>(
    (assetsForTaskRes.data ?? []).map((a) => [a.id, a.property_name]),
  );

  const tasks_due: MyDayTask[] = (tasksRes.data ?? []).map((t) => {
    const due = t.due_date ? new Date(t.due_date) : null;
    const overdue_days = due
      ? Math.max(0, Math.floor((startOfDay(now).getTime() - startOfDay(due).getTime()) / DAY_MS))
      : 0;
    return {
      id: t.id,
      asset_id: t.asset_id,
      title: t.title,
      priority: t.priority,
      due_date: t.due_date,
      overdue_days,
      asset_name: assetNameMap.get(t.asset_id) ?? 'Unknown',
    };
  });

  // Owned assets where last activity is older than 5 days
  const activityRes = await service
    .from('activity_logs')
    .select('entity_id, created_at')
    .eq('entity_type', 'asset')
    .in('entity_id', (ownedRes.data ?? []).map((a) => a.id))
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  const lastTouchMap = new Map<string, string>();
  for (const log of activityRes.data ?? []) {
    if (!lastTouchMap.has(log.entity_id)) lastTouchMap.set(log.entity_id, log.created_at);
  }

  const silent_assets: MyDayAsset[] = (ownedRes.data ?? [])
    .map((a) => {
      const last = lastTouchMap.get(a.id) ?? a.updated_at;
      const days_silent = Math.floor((now.getTime() - new Date(last).getTime()) / DAY_MS);
      return {
        id: a.id,
        property_name: a.property_name,
        status: a.status as AssetStatus,
        days_silent,
        temperature: a.temperature ?? 'none',
      };
    })
    .filter((a) => a.days_silent >= 5 || new Date(lastTouchMap.get(a.id) ?? '0').toISOString() < fiveDaysAgo)
    .sort((a, b) => b.days_silent - a.days_silent)
    .slice(0, 6);

  type MoveRow = {
    asset_id: string;
    from_status: AssetStatus | null;
    to_status: AssetStatus;
    changed_at: string;
    assets: { property_name: string } | { property_name: string }[] | null;
  };

  const this_week_moves: MyDayMove[] = ((movesRes.data ?? []) as MoveRow[]).map((m) => {
    const assetRel = Array.isArray(m.assets) ? m.assets[0] : m.assets;
    return {
      asset_id: m.asset_id,
      property_name: assetRel?.property_name ?? 'Unknown',
      from_status: m.from_status,
      to_status: m.to_status,
      changed_at: m.changed_at,
    };
  });

  return {
    tasks_due,
    silent_assets,
    this_week_moves,
    updates_today: updatesTodayRes.count ?? 0,
  };
}

// ─── 2. Update Streak ────────────────────────────────────────────────────────

export type UpdateStreak = {
  current_streak: number;
  longest_streak_30d: number;
  days: { date: string; active: boolean }[]; // last 30 days
};

export async function getUpdateStreak(memberId: string): Promise<UpdateStreak> {
  const service = createServiceClient();
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY_MS).toISOString();

  const { data } = await service
    .from('activity_logs')
    .select('created_at')
    .eq('actor_id', memberId)
    .gte('created_at', thirtyDaysAgo)
    .is('deleted_at', null);

  const activeDates = new Set<string>();
  for (const row of data ?? []) {
    activeDates.add(row.created_at.slice(0, 10));
  }

  const days: { date: string; active: boolean }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * DAY_MS);
    const iso = startOfDay(d).toISOString().slice(0, 10);
    days.push({ date: iso, active: activeDates.has(iso) });
  }

  // Current streak: walk from today backward while active
  let current_streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].active) current_streak++;
    else break;
  }

  // Longest streak in last 30
  let longest = 0;
  let run = 0;
  for (const d of days) {
    if (d.active) {
      run++;
      if (run > longest) longest = run;
    } else {
      run = 0;
    }
  }

  return { current_streak, longest_streak_30d: longest, days };
}

// ─── 3. Closing the Loop ─────────────────────────────────────────────────────

export type ClosingLoop = {
  ball_in_your_court: { id: string; property_name: string; days_waiting: number }[];
  waiting_on_others: { id: string; property_name: string; days_waiting: number; assignee: string | null }[];
};

export async function getClosingLoop(memberId: string): Promise<ClosingLoop> {
  const service = createServiceClient();

  // Owned assets (assigned_to OR created_by user)
  const { data: ownedAssets } = await service
    .from('assets')
    .select('id, property_name, assigned_to, created_by')
    .is('deleted_at', null)
    .not('status', 'in', '("dropped","won")')
    .or(`assigned_to.eq.${memberId},created_by.eq.${memberId}`);

  if (!ownedAssets || ownedAssets.length === 0) {
    return { ball_in_your_court: [], waiting_on_others: [] };
  }

  const ids = ownedAssets.map((a) => a.id);

  // Latest update per asset (who last touched it)
  const { data: updates } = await service
    .from('updates')
    .select('asset_id, created_by, created_at')
    .in('asset_id', ids)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  const lastUpdateMap = new Map<string, { by: string; at: string }>();
  for (const u of updates ?? []) {
    if (!lastUpdateMap.has(u.asset_id)) {
      lastUpdateMap.set(u.asset_id, { by: u.created_by, at: u.created_at });
    }
  }

  // Open tasks on those assets (with assignee names)
  const { data: openTasks } = await service
    .from('tasks')
    .select('asset_id, assigned_to, due_date, created_at')
    .in('asset_id', ids)
    .is('deleted_at', null)
    .not('status', 'in', '("done","cancelled")');

  const taskByAsset = new Map<string, { assigned_to: string | null; created_at: string }[]>();
  for (const t of openTasks ?? []) {
    const arr = taskByAsset.get(t.asset_id) ?? [];
    arr.push({ assigned_to: t.assigned_to, created_at: t.created_at });
    taskByAsset.set(t.asset_id, arr);
  }

  // Resolve team member names
  const otherIds = new Set<string>();
  for (const tasks of taskByAsset.values()) {
    for (const t of tasks) if (t.assigned_to && t.assigned_to !== memberId) otherIds.add(t.assigned_to);
  }
  const { data: members } = await service
    .from('team_members')
    .select('id, full_name')
    .in('id', [...otherIds]);
  const memberMap = new Map((members ?? []).map((m) => [m.id, m.full_name]));

  const now = Date.now();
  const ball_in_your_court: ClosingLoop['ball_in_your_court'] = [];
  const waiting_on_others: ClosingLoop['waiting_on_others'] = [];

  for (const a of ownedAssets) {
    const lastUpd = lastUpdateMap.get(a.id);
    const tasks = taskByAsset.get(a.id) ?? [];

    // Ball in your court: last update by someone else, no open task assigned to others
    const lastByOther = lastUpd && lastUpd.by !== memberId;
    const openTasksOnOthers = tasks.filter((t) => t.assigned_to && t.assigned_to !== memberId);

    if (lastByOther && openTasksOnOthers.length === 0) {
      const days = Math.floor((now - new Date(lastUpd!.at).getTime()) / DAY_MS);
      ball_in_your_court.push({ id: a.id, property_name: a.property_name, days_waiting: days });
    } else if (openTasksOnOthers.length > 0) {
      // Waiting on others
      const oldest = openTasksOnOthers.sort(
        (x, y) => new Date(x.created_at).getTime() - new Date(y.created_at).getTime(),
      )[0];
      const days = Math.floor((now - new Date(oldest.created_at).getTime()) / DAY_MS);
      waiting_on_others.push({
        id: a.id,
        property_name: a.property_name,
        days_waiting: days,
        assignee: oldest.assigned_to ? memberMap.get(oldest.assigned_to) ?? null : null,
      });
    }
  }

  return {
    ball_in_your_court: ball_in_your_court.sort((a, b) => b.days_waiting - a.days_waiting).slice(0, 6),
    waiting_on_others: waiting_on_others.sort((a, b) => b.days_waiting - a.days_waiting).slice(0, 6),
  };
}

// ─── 4. Handoff Health (developer shares lifecycle) ──────────────────────────

export type HandoffStage = 'shared' | 'im' | 'ff' | 'eoi';

export type HandoffShare = {
  share_id: string;
  asset_id: string;
  property_name: string;
  developer_name: string;
  shared_at: string;
  stage_reached: HandoffStage;
  days_in_stage: number;
  is_stalled: boolean;
};

export type HandoffHealth = {
  shares: HandoffShare[];
  stage_medians_days: { im: number; ff: number; eoi: number };
  totals: { shared: number; im: number; ff: number; eoi: number };
};

export async function getHandoffHealth(): Promise<HandoffHealth> {
  const service = createServiceClient();

  const [sharesRes, tasksRes] = await Promise.all([
    service
      .from('developer_shares')
      .select('id, asset_id, shared_at, developer_id, assets(property_name), developers(name)')
      .is('deleted_at', null)
      .order('shared_at', { ascending: false })
      .limit(60),
    service
      .from('share_tasks')
      .select('share_id, task_type, completed_at, status')
      .is('deleted_at', null),
  ]);

  type ShareRow = {
    id: string;
    asset_id: string;
    shared_at: string;
    developer_id: string;
    assets: { property_name: string } | { property_name: string }[] | null;
    developers: { name: string } | { name: string }[] | null;
  };

  // Group tasks by share + type
  const stageMap = new Map<string, { im?: string; ff?: string; eoi?: string }>();
  for (const t of tasksRes.data ?? []) {
    if (!t.completed_at) continue;
    const entry = stageMap.get(t.share_id) ?? {};
    if (t.task_type === 'im_shared') entry.im = t.completed_at;
    if (t.task_type === 'ff_shared') entry.ff = t.completed_at;
    if (t.task_type === 'eoi_issued') entry.eoi = t.completed_at;
    stageMap.set(t.share_id, entry);
  }

  const now = Date.now();
  const STALL_THRESHOLD_DAYS = 14;

  const imDeltas: number[] = [];
  const ffDeltas: number[] = [];
  const eoiDeltas: number[] = [];

  const shares: HandoffShare[] = ((sharesRes.data ?? []) as ShareRow[]).map((s) => {
    const stages = stageMap.get(s.id) ?? {};
    const sharedAt = new Date(s.shared_at).getTime();

    let stage_reached: HandoffStage = 'shared';
    let lastStageAt = sharedAt;

    if (stages.im) {
      stage_reached = 'im';
      lastStageAt = new Date(stages.im).getTime();
      imDeltas.push((lastStageAt - sharedAt) / DAY_MS);
    }
    if (stages.ff) {
      stage_reached = 'ff';
      const ffAt = new Date(stages.ff).getTime();
      if (stages.im) ffDeltas.push((ffAt - new Date(stages.im).getTime()) / DAY_MS);
      lastStageAt = ffAt;
    }
    if (stages.eoi) {
      stage_reached = 'eoi';
      const eoiAt = new Date(stages.eoi).getTime();
      if (stages.ff) eoiDeltas.push((eoiAt - new Date(stages.ff).getTime()) / DAY_MS);
      lastStageAt = eoiAt;
    }

    const days_in_stage = Math.floor((now - lastStageAt) / DAY_MS);
    const is_stalled = stage_reached !== 'eoi' && days_in_stage >= STALL_THRESHOLD_DAYS;

    const assetRel = Array.isArray(s.assets) ? s.assets[0] : s.assets;
    const devRel = Array.isArray(s.developers) ? s.developers[0] : s.developers;

    return {
      share_id: s.id,
      asset_id: s.asset_id,
      property_name: assetRel?.property_name ?? 'Unknown',
      developer_name: devRel?.name ?? 'Unknown',
      shared_at: s.shared_at,
      stage_reached,
      days_in_stage,
      is_stalled,
    };
  });

  const totals = shares.reduce(
    (acc, s) => {
      acc.shared++;
      if (s.stage_reached === 'im' || s.stage_reached === 'ff' || s.stage_reached === 'eoi') acc.im++;
      if (s.stage_reached === 'ff' || s.stage_reached === 'eoi') acc.ff++;
      if (s.stage_reached === 'eoi') acc.eoi++;
      return acc;
    },
    { shared: 0, im: 0, ff: 0, eoi: 0 },
  );

  return {
    shares: shares
      .sort((a, b) => (b.is_stalled === a.is_stalled ? b.days_in_stage - a.days_in_stage : b.is_stalled ? 1 : -1))
      .slice(0, 10),
    stage_medians_days: {
      im: Math.round(median(imDeltas)),
      ff: Math.round(median(ffDeltas)),
      eoi: Math.round(median(eoiDeltas)),
    },
    totals,
  };
}

// ─── 5. Collaboration Graph ──────────────────────────────────────────────────

export type CollabAssetSummary = {
  asset_id: string;
  property_name: string;
  contributor_count: number;
  contributors: { member_id: string; name: string; updates: number }[];
};

export type CollabGraph = {
  lone_wolf_assets: CollabAssetSummary[]; // 1 contributor in 30d
  shared_assets: CollabAssetSummary[]; // 3+ contributors
  total_active_assets: number;
};

export async function getCollabGraph(): Promise<CollabGraph> {
  const service = createServiceClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * DAY_MS).toISOString();

  const [assetsRes, updatesRes, membersRes] = await Promise.all([
    service
      .from('assets')
      .select('id, property_name, status')
      .is('deleted_at', null)
      .not('status', 'in', '("dropped","won")'),
    service
      .from('updates')
      .select('asset_id, created_by')
      .gte('created_at', thirtyDaysAgo)
      .is('deleted_at', null),
    service.from('team_members').select('id, full_name'),
  ]);

  const memberMap = new Map<string, string>((membersRes.data ?? []).map((m) => [m.id, m.full_name]));
  const assetMap = new Map<string, string>((assetsRes.data ?? []).map((a) => [a.id, a.property_name]));

  // count updates per (asset, member)
  const counts = new Map<string, Map<string, number>>();
  for (const u of updatesRes.data ?? []) {
    if (!assetMap.has(u.asset_id)) continue; // skip closed assets
    const perAsset = counts.get(u.asset_id) ?? new Map<string, number>();
    perAsset.set(u.created_by, (perAsset.get(u.created_by) ?? 0) + 1);
    counts.set(u.asset_id, perAsset);
  }

  const summaries: CollabAssetSummary[] = [];
  for (const [asset_id, perAsset] of counts) {
    const contributors = [...perAsset.entries()]
      .map(([member_id, updates]) => ({
        member_id,
        name: memberMap.get(member_id) ?? 'Unknown',
        updates,
      }))
      .sort((a, b) => b.updates - a.updates);

    summaries.push({
      asset_id,
      property_name: assetMap.get(asset_id) ?? 'Unknown',
      contributor_count: contributors.length,
      contributors,
    });
  }

  return {
    lone_wolf_assets: summaries
      .filter((s) => s.contributor_count === 1)
      .sort((a, b) => b.contributors[0].updates - a.contributors[0].updates)
      .slice(0, 6),
    shared_assets: summaries
      .filter((s) => s.contributor_count >= 3)
      .sort((a, b) => b.contributor_count - a.contributor_count)
      .slice(0, 6),
    total_active_assets: assetsRes.data?.length ?? 0,
  };
}

// ─── 6. Quiet Assets by Owner (heatmap) ──────────────────────────────────────

export type QuietBucket = 'fresh' | 'd3to7' | 'd7to14' | 'd14to30' | 'over30';

export type QuietOwnerRow = {
  member_id: string;
  full_name: string;
  buckets: Record<QuietBucket, number>;
  total: number;
};

export type QuietAssetsByOwner = {
  rows: QuietOwnerRow[];
};

export async function getQuietAssetsByOwner(): Promise<QuietAssetsByOwner> {
  const service = createServiceClient();

  const [assetsRes, activityRes, membersRes] = await Promise.all([
    service
      .from('assets')
      .select('id, assigned_to, updated_at, created_at')
      .is('deleted_at', null)
      .not('status', 'in', '("dropped","won")')
      .not('assigned_to', 'is', null),
    service
      .from('activity_logs')
      .select('entity_id, created_at')
      .eq('entity_type', 'asset')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(2000),
    service.from('team_members').select('id, full_name').eq('is_active', true).eq('status', 'active'),
  ]);

  const lastTouch = new Map<string, string>();
  for (const log of activityRes.data ?? []) {
    if (!lastTouch.has(log.entity_id)) lastTouch.set(log.entity_id, log.created_at);
  }

  const now = Date.now();
  const byMember = new Map<string, Record<QuietBucket, number>>();

  function emptyBuckets(): Record<QuietBucket, number> {
    return { fresh: 0, d3to7: 0, d7to14: 0, d14to30: 0, over30: 0 };
  }

  for (const a of assetsRes.data ?? []) {
    if (!a.assigned_to) continue;
    const ref = lastTouch.get(a.id) ?? a.updated_at ?? a.created_at;
    const days = Math.floor((now - new Date(ref).getTime()) / DAY_MS);

    let bucket: QuietBucket;
    if (days < 3) bucket = 'fresh';
    else if (days < 7) bucket = 'd3to7';
    else if (days < 14) bucket = 'd7to14';
    else if (days < 30) bucket = 'd14to30';
    else bucket = 'over30';

    const counts = byMember.get(a.assigned_to) ?? emptyBuckets();
    counts[bucket]++;
    byMember.set(a.assigned_to, counts);
  }

  const rows: QuietOwnerRow[] = (membersRes.data ?? [])
    .map((m) => {
      const buckets = byMember.get(m.id) ?? emptyBuckets();
      const total = Object.values(buckets).reduce((s, n) => s + n, 0);
      return { member_id: m.id, full_name: m.full_name, buckets, total };
    })
    .filter((r) => r.total > 0)
    .sort((a, b) => b.buckets.over30 + b.buckets.d14to30 - (a.buckets.over30 + a.buckets.d14to30));

  return { rows };
}

// ─── 7. Week-over-Week ───────────────────────────────────────────────────────

export type WoWMetric = {
  label: string;
  this_week: number;
  last_week: number;
};

export type WeekOverWeek = {
  metrics: WoWMetric[];
  week_start_iso: string;
  last_week_start_iso: string;
};

export async function getWeekOverWeek(): Promise<WeekOverWeek> {
  const service = createServiceClient();
  const now = new Date();
  const thisWeekStart = startOfWeek(now);
  const lastWeekStart = new Date(thisWeekStart.getTime() - 7 * DAY_MS);
  const thisWeekIso = thisWeekStart.toISOString();
  const lastWeekIso = lastWeekStart.toISOString();
  const nextIso = new Date(thisWeekStart.getTime() + 7 * DAY_MS).toISOString();

  const [
    transitionsThis,
    transitionsLast,
    updatesThis,
    updatesLast,
    tasksClosedThis,
    tasksClosedLast,
    newAssetsThis,
    newAssetsLast,
  ] = await Promise.all([
    service.from('status_history').select('id', { count: 'exact', head: true }).gte('changed_at', thisWeekIso).lt('changed_at', nextIso),
    service.from('status_history').select('id', { count: 'exact', head: true }).gte('changed_at', lastWeekIso).lt('changed_at', thisWeekIso),
    service.from('updates').select('id', { count: 'exact', head: true }).gte('created_at', thisWeekIso).lt('created_at', nextIso).is('deleted_at', null),
    service.from('updates').select('id', { count: 'exact', head: true }).gte('created_at', lastWeekIso).lt('created_at', thisWeekIso).is('deleted_at', null),
    service.from('tasks').select('id', { count: 'exact', head: true }).gte('completed_at', thisWeekIso).lt('completed_at', nextIso).is('deleted_at', null),
    service.from('tasks').select('id', { count: 'exact', head: true }).gte('completed_at', lastWeekIso).lt('completed_at', thisWeekIso).is('deleted_at', null),
    service.from('assets').select('id', { count: 'exact', head: true }).gte('created_at', thisWeekIso).lt('created_at', nextIso).is('deleted_at', null),
    service.from('assets').select('id', { count: 'exact', head: true }).gte('created_at', lastWeekIso).lt('created_at', thisWeekIso).is('deleted_at', null),
  ]);

  return {
    metrics: [
      { label: 'Stage moves', this_week: transitionsThis.count ?? 0, last_week: transitionsLast.count ?? 0 },
      { label: 'Updates posted', this_week: updatesThis.count ?? 0, last_week: updatesLast.count ?? 0 },
      { label: 'Tasks closed', this_week: tasksClosedThis.count ?? 0, last_week: tasksClosedLast.count ?? 0 },
      { label: 'New assets', this_week: newAssetsThis.count ?? 0, last_week: newAssetsLast.count ?? 0 },
    ],
    week_start_iso: thisWeekIso,
    last_week_start_iso: lastWeekIso,
  };
}

// ─── 8. Stage Throughput ─────────────────────────────────────────────────────

export type StageThroughput = {
  stages: {
    status: AssetStatus;
    median_days_historical: number;
    avg_days_current_cohort: number;
    current_count: number;
  }[];
};

export async function getStageThroughput(): Promise<StageThroughput> {
  const service = createServiceClient();
  const ninetyDaysAgo = new Date(Date.now() - 90 * DAY_MS).toISOString();

  const [historyRes, currentRes] = await Promise.all([
    service
      .from('status_history')
      .select('asset_id, from_status, to_status, changed_at')
      .gte('changed_at', ninetyDaysAgo)
      .order('changed_at', { ascending: true }),
    service
      .from('assets')
      .select('id, status, updated_at, created_at')
      .is('deleted_at', null)
      .not('status', 'in', '("dropped","won")'),
  ]);

  // Build sequences per asset
  const seqMap = new Map<string, { status: AssetStatus; at: number }[]>();
  for (const h of historyRes.data ?? []) {
    const arr = seqMap.get(h.asset_id) ?? [];
    arr.push({ status: h.to_status as AssetStatus, at: new Date(h.changed_at).getTime() });
    seqMap.set(h.asset_id, arr);
  }

  const STAGES: AssetStatus[] = ['open', 'evaluating', 'screened'];
  const stageDays = new Map<AssetStatus, number[]>();
  STAGES.forEach((s) => stageDays.set(s, []));

  for (const seq of seqMap.values()) {
    seq.sort((a, b) => a.at - b.at);
    for (let i = 0; i < seq.length - 1; i++) {
      const cur = seq[i];
      const next = seq[i + 1];
      if (stageDays.has(cur.status)) {
        const days = (next.at - cur.at) / DAY_MS;
        if (days >= 0 && days < 365) stageDays.get(cur.status)!.push(days);
      }
    }
  }

  // Latest transition per asset (for current cohort)
  const lastTransitionMap = new Map<string, number>();
  for (const h of historyRes.data ?? []) {
    const t = new Date(h.changed_at).getTime();
    const prev = lastTransitionMap.get(h.asset_id);
    if (prev === undefined || t > prev) lastTransitionMap.set(h.asset_id, t);
  }

  const now = Date.now();
  const currentByStage = new Map<AssetStatus, number[]>();
  STAGES.forEach((s) => currentByStage.set(s, []));

  for (const a of currentRes.data ?? []) {
    if (!STAGES.includes(a.status as AssetStatus)) continue;
    const ref = lastTransitionMap.get(a.id) ?? new Date(a.created_at).getTime();
    const days = Math.floor((now - ref) / DAY_MS);
    currentByStage.get(a.status as AssetStatus)!.push(days);
  }

  return {
    stages: STAGES.map((s) => {
      const cur = currentByStage.get(s) ?? [];
      return {
        status: s,
        median_days_historical: Math.round(median(stageDays.get(s) ?? [])),
        avg_days_current_cohort: cur.length > 0 ? Math.round(cur.reduce((a, b) => a + b, 0) / cur.length) : 0,
        current_count: cur.length,
      };
    }),
  };
}

// ─── 9. Task SLA ─────────────────────────────────────────────────────────────

export type TaskSlaRow = {
  member_id: string;
  full_name: string;
  total: number;
  on_time: number;
  on_time_pct: number;
};

export type TaskSla = {
  rows: TaskSlaRow[];
  overall_pct: number;
  total_tasks: number;
};

export async function getTaskSla(): Promise<TaskSla> {
  const service = createServiceClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * DAY_MS).toISOString();

  const [tasksRes, membersRes] = await Promise.all([
    service
      .from('tasks')
      .select('assigned_to, priority, due_date, completed_at, status')
      .is('deleted_at', null)
      .in('priority', ['high', 'urgent'])
      .not('assigned_to', 'is', null)
      .gte('completed_at', thirtyDaysAgo)
      .eq('status', 'done'),
    service.from('team_members').select('id, full_name').eq('is_active', true),
  ]);

  const memberMap = new Map<string, string>((membersRes.data ?? []).map((m) => [m.id, m.full_name]));
  const byMember = new Map<string, { total: number; on_time: number }>();

  for (const t of tasksRes.data ?? []) {
    if (!t.assigned_to || !t.completed_at) continue;
    const stats = byMember.get(t.assigned_to) ?? { total: 0, on_time: 0 };
    stats.total++;
    if (t.due_date) {
      // due_date is DATE — compare to end-of-due-day
      const due = new Date(t.due_date);
      due.setHours(23, 59, 59, 999);
      const completed = new Date(t.completed_at);
      if (completed <= due) stats.on_time++;
    } else {
      stats.on_time++; // no SLA defined -> count as on-time
    }
    byMember.set(t.assigned_to, stats);
  }

  const rows: TaskSlaRow[] = [...byMember.entries()]
    .map(([member_id, stats]) => ({
      member_id,
      full_name: memberMap.get(member_id) ?? 'Unknown',
      total: stats.total,
      on_time: stats.on_time,
      on_time_pct: stats.total > 0 ? Math.round((stats.on_time / stats.total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  const totalTasks = rows.reduce((s, r) => s + r.total, 0);
  const totalOnTime = rows.reduce((s, r) => s + r.on_time, 0);

  return {
    rows,
    overall_pct: totalTasks > 0 ? Math.round((totalOnTime / totalTasks) * 100) : 0,
    total_tasks: totalTasks,
  };
}

// ─── 10. Orphaned Work ───────────────────────────────────────────────────────

export type OrphanItem = {
  id: string;
  label: string;
  kind: 'asset' | 'task';
  former_owner: string;
  days_orphaned: number;
};

export type OrphanedWork = {
  items: OrphanItem[];
  total_assets: number;
  total_tasks: number;
};

export async function getOrphanedWork(): Promise<OrphanedWork> {
  const service = createServiceClient();

  const { data: offboarded } = await service
    .from('team_members')
    .select('id, full_name')
    .or('status.eq.deactivated,is_active.eq.false');

  if (!offboarded || offboarded.length === 0) {
    return { items: [], total_assets: 0, total_tasks: 0 };
  }

  const offMap = new Map(offboarded.map((m) => [m.id, m.full_name]));
  const offIds = offboarded.map((m) => m.id);

  const [assetsRes, tasksRes] = await Promise.all([
    service
      .from('assets')
      .select('id, property_name, assigned_to, updated_at')
      .is('deleted_at', null)
      .not('status', 'in', '("dropped","won")')
      .in('assigned_to', offIds),
    service
      .from('tasks')
      .select('id, title, assigned_to, updated_at')
      .is('deleted_at', null)
      .not('status', 'in', '("done","cancelled")')
      .in('assigned_to', offIds),
  ]);

  const now = Date.now();

  const items: OrphanItem[] = [
    ...(assetsRes.data ?? []).map((a) => ({
      id: a.id,
      label: a.property_name,
      kind: 'asset' as const,
      former_owner: offMap.get(a.assigned_to!) ?? 'Unknown',
      days_orphaned: Math.floor((now - new Date(a.updated_at).getTime()) / DAY_MS),
    })),
    ...(tasksRes.data ?? []).map((t) => ({
      id: t.id,
      label: t.title,
      kind: 'task' as const,
      former_owner: offMap.get(t.assigned_to!) ?? 'Unknown',
      days_orphaned: Math.floor((now - new Date(t.updated_at).getTime()) / DAY_MS),
    })),
  ].sort((a, b) => b.days_orphaned - a.days_orphaned);

  return {
    items: items.slice(0, 10),
    total_assets: assetsRes.data?.length ?? 0,
    total_tasks: tasksRes.data?.length ?? 0,
  };
}

// ─── 11. Engagement Coverage ─────────────────────────────────────────────────

export type EngagementCoverage = {
  active_assets: number;
  with_engagement: number;
  without_engagement: number;
  coverage_pct: number;
  uncovered_examples: { id: string; property_name: string; status: AssetStatus }[];
};

export async function getEngagementCoverage(): Promise<EngagementCoverage> {
  const service = createServiceClient();

  const [assetsRes, engagementsRes] = await Promise.all([
    service
      .from('assets')
      .select('id, property_name, status')
      .is('deleted_at', null)
      .in('status', ['evaluating', 'screened']),
    service.from('engagements').select('asset_id, ended_at'),
  ]);

  const activeEngagementAssets = new Set<string>();
  for (const e of engagementsRes.data ?? []) {
    if (!e.ended_at || new Date(e.ended_at).getTime() > Date.now()) {
      activeEngagementAssets.add(e.asset_id);
    }
  }

  const assets = assetsRes.data ?? [];
  const withEng = assets.filter((a) => activeEngagementAssets.has(a.id));
  const withoutEng = assets.filter((a) => !activeEngagementAssets.has(a.id));

  return {
    active_assets: assets.length,
    with_engagement: withEng.length,
    without_engagement: withoutEng.length,
    coverage_pct: assets.length > 0 ? Math.round((withEng.length / assets.length) * 100) : 0,
    uncovered_examples: withoutEng.slice(0, 6).map((a) => ({
      id: a.id,
      property_name: a.property_name,
      status: a.status as AssetStatus,
    })),
  };
}
