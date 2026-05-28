import { createServiceClient } from '@/lib/supabase/service';
import { CM_ENTITY_TYPES } from '@/lib/queries/logs';
import { getCommandStats } from '@/lib/queries/dashboard';
import type {
  EodReportPayload,
  EodMemberRow,
  EodStatusMove,
  EodAttentionItem,
  EodRecipientScope,
} from '@/lib/schemas/eod-report';

// IST is UTC+5:30. We want "today in IST" — a 24h window anchored to the IST
// calendar day so the report covers a single business day no matter when the
// cron fires (the 9pm IST cron lands at 15:30 UTC on the same IST date).
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

export function istDayWindow(reference: Date = new Date()): {
  startUtc: string;
  endUtc: string;
  istDateIso: string;
} {
  const ist = new Date(reference.getTime() + IST_OFFSET_MS);
  const istDateIso = ist.toISOString().slice(0, 10); // YYYY-MM-DD in IST
  const startUtcMs = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - IST_OFFSET_MS;
  const endUtcMs = startUtcMs + 24 * 60 * 60 * 1000;
  return {
    startUtc: new Date(startUtcMs).toISOString(),
    endUtc: new Date(endUtcMs).toISOString(),
    istDateIso,
  };
}

async function resolveRecipients(scope: EodRecipientScope): Promise<{
  emails: string[];
  excludedCount: number;
}> {
  const service = createServiceClient();

  if (scope === 'admins_only') {
    const { data } = await service
      .from('team_members')
      .select('email')
      .eq('role', 'admin')
      .eq('is_active', true)
      .eq('status', 'active');
    return { emails: (data ?? []).map((r) => r.email).filter(Boolean), excludedCount: 0 };
  }

  // cm_team
  const [{ data: members }, { data: optOuts }] = await Promise.all([
    service
      .from('team_members')
      .select('id, email')
      .in('department', ['cm', 'both'])
      .eq('is_active', true)
      .eq('status', 'active'),
    service.from('eod_report_opt_outs').select('member_id'),
  ]);

  const excluded = new Set((optOuts ?? []).map((r) => r.member_id as string));
  const eligible = (members ?? []).filter((m) => !excluded.has(m.id));
  return {
    emails: eligible.map((m) => m.email).filter(Boolean),
    excludedCount: (members ?? []).length - eligible.length,
  };
}

export async function getEodReportData(
  reference: Date = new Date(),
  scope: EodRecipientScope = 'admins_only'
): Promise<EodReportPayload> {
  const service = createServiceClient();
  const { startUtc, endUtc, istDateIso } = istDayWindow(reference);

  const [
    kpis,
    activityRes,
    statusHistRes,
    tasksCreatedRes,
    tasksCompletedRes,
    updatesTodayRes,
    newAssetsRes,
    cmMembersRes,
    recipients,
  ] = await Promise.all([
    getCommandStats(),
    service
      .from('activity_logs')
      .select('actor_id, action, entity_type, created_at')
      .in('entity_type', CM_ENTITY_TYPES)
      .gte('created_at', startUtc)
      .lt('created_at', endUtc)
      .is('deleted_at', null),
    service
      .from('status_history')
      .select('asset_id, from_status, to_status, changed_at, changed_by, assets(property_name)')
      .gte('changed_at', startUtc)
      .lt('changed_at', endUtc)
      .order('changed_at', { ascending: false }),
    service
      .from('tasks')
      .select('id, assigned_to, created_by')
      .gte('created_at', startUtc)
      .lt('created_at', endUtc)
      .is('deleted_at', null),
    service
      .from('tasks')
      .select('id, assigned_to')
      .gte('completed_at', startUtc)
      .lt('completed_at', endUtc)
      .eq('status', 'done')
      .is('deleted_at', null),
    service
      .from('updates')
      .select('id, created_by')
      .gte('created_at', startUtc)
      .lt('created_at', endUtc)
      .is('deleted_at', null),
    service
      .from('assets')
      .select('id, created_by')
      .gte('created_at', startUtc)
      .lt('created_at', endUtc)
      .is('deleted_at', null),
    service
      .from('team_members')
      .select('id, full_name')
      .in('department', ['cm', 'both'])
      .eq('is_active', true)
      .eq('status', 'active'),
    resolveRecipients(scope),
  ]);

  // Per-member tallies — keyed by member id, lookup by CM membership.
  const memberMap = new Map<string, string>((cmMembersRes.data ?? []).map((m) => [m.id, m.full_name]));
  type Tally = { updates: number; status_changes: number; tasks_created: number; tasks_completed: number };
  const tally = new Map<string, Tally>();
  const ensure = (id: string): Tally => {
    let t = tally.get(id);
    if (!t) {
      t = { updates: 0, status_changes: 0, tasks_created: 0, tasks_completed: 0 };
      tally.set(id, t);
    }
    return t;
  };

  for (const u of updatesTodayRes.data ?? []) {
    if (u.created_by && memberMap.has(u.created_by)) ensure(u.created_by).updates += 1;
  }
  for (const h of statusHistRes.data ?? []) {
    if (h.changed_by && memberMap.has(h.changed_by)) ensure(h.changed_by).status_changes += 1;
  }
  for (const t of tasksCreatedRes.data ?? []) {
    if (t.created_by && memberMap.has(t.created_by)) ensure(t.created_by).tasks_created += 1;
  }
  for (const t of tasksCompletedRes.data ?? []) {
    if (t.assigned_to && memberMap.has(t.assigned_to)) ensure(t.assigned_to).tasks_completed += 1;
  }

  const member_rows: EodMemberRow[] = [...tally.entries()]
    .map(([member_id, t]) => ({
      member_id,
      full_name: memberMap.get(member_id) ?? 'Unknown',
      updates: t.updates,
      status_changes: t.status_changes,
      tasks_completed: t.tasks_completed,
      tasks_created: t.tasks_created,
      total_actions: t.updates + t.status_changes + t.tasks_created + t.tasks_completed,
    }))
    .sort((a, b) => b.total_actions - a.total_actions);

  // Status moves with property + actor names resolved.
  type StatusRow = {
    asset_id: string;
    from_status: string | null;
    to_status: string;
    changed_at: string;
    changed_by: string | null;
    assets: { property_name: string } | { property_name: string }[] | null;
  };
  const rawMoves = (statusHistRes.data ?? []) as StatusRow[];
  const moveActorIds = [...new Set(rawMoves.map((r) => r.changed_by).filter(Boolean))] as string[];
  let moveActorMap = new Map<string, string>();
  if (moveActorIds.length) {
    const { data: actors } = await service
      .from('team_members')
      .select('id, full_name')
      .in('id', moveActorIds);
    moveActorMap = new Map((actors ?? []).map((m) => [m.id, m.full_name]));
  }

  const status_moves: EodStatusMove[] = rawMoves.map((m) => {
    const assetRel = Array.isArray(m.assets) ? m.assets[0] : m.assets;
    return {
      asset_id: m.asset_id,
      property_name: assetRel?.property_name ?? 'Unknown',
      from_status: m.from_status,
      to_status: m.to_status,
      changed_by: m.changed_by ? moveActorMap.get(m.changed_by) ?? 'Unknown' : 'System',
      changed_at: m.changed_at,
    };
  });

  // Headline tallies — derived from the same raw fetches so totals match per-member.
  const wonToday = rawMoves.filter((m) => m.to_status === 'won').length;
  const droppedToday = rawMoves.filter((m) => m.to_status === 'dropped').length;
  const activeMembersToday = new Set<string>();
  for (const log of activityRes.data ?? []) {
    if (log.actor_id) activeMembersToday.add(log.actor_id);
  }

  // Attention list — hot+unassigned, hot+silent, stale stages, orphaned work hint.
  // Kept lightweight: a few items max so the email stays scannable.
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [hotRes, activityForHotRes, offboardedRes] = await Promise.all([
    service
      .from('assets')
      .select('id, property_name, status, temperature, assigned_to, spoc_agent')
      .is('deleted_at', null)
      .eq('temperature', 'hot')
      .not('status', 'in', '("dropped","won")'),
    service
      .from('activity_logs')
      .select('entity_id')
      .eq('entity_type', 'asset')
      .gte('created_at', sevenDaysAgo)
      .is('deleted_at', null),
    service
      .from('team_members')
      .select('id')
      .or('status.eq.deactivated,is_active.eq.false'),
  ]);

  const recentSet = new Set((activityForHotRes.data ?? []).map((r) => r.entity_id as string));
  const attention: EodAttentionItem[] = [];

  for (const a of hotRes.data ?? []) {
    if (!a.spoc_agent && !a.assigned_to) {
      attention.push({
        id: a.id,
        property_name: a.property_name,
        reason: 'Hot — no owner',
        detail: 'Assign before it goes cold.',
      });
    } else if (!recentSet.has(a.id)) {
      attention.push({
        id: a.id,
        property_name: a.property_name,
        reason: 'Hot — silent 7+ days',
        detail: 'No activity logged in the last week.',
      });
    }
  }

  if ((offboardedRes.data ?? []).length > 0) {
    const offIds = (offboardedRes.data ?? []).map((r) => r.id as string);
    const { count } = await service
      .from('assets')
      .select('id', { count: 'exact', head: true })
      .is('deleted_at', null)
      .not('status', 'in', '("dropped","won")')
      .in('assigned_to', offIds);
    if ((count ?? 0) > 0) {
      attention.push({
        id: '00000000-0000-0000-0000-000000000000',
        property_name: `${count} orphaned ${count === 1 ? 'asset' : 'assets'}`,
        reason: 'Offboarded owner',
        detail: 'Reassign via the team handover page.',
      });
    }
  }

  return {
    report_date_ist: istDateIso,
    kpis: {
      active_pipeline_cr: kpis.activePipelineValue,
      active_count: kpis.activeCount,
      hot_count: kpis.hotCount,
      win_rate_pct: kpis.winRate,
      won_this_quarter: kpis.wonCountQ,
      dropped_this_quarter: kpis.droppedCountQ,
    },
    today: {
      updates: (updatesTodayRes.data ?? []).length,
      status_changes: rawMoves.length,
      tasks_created: (tasksCreatedRes.data ?? []).length,
      tasks_completed: (tasksCompletedRes.data ?? []).length,
      new_assets: (newAssetsRes.data ?? []).length,
      won: wonToday,
      dropped: droppedToday,
      active_members: activeMembersToday.size,
    },
    member_rows,
    status_moves: status_moves.slice(0, 30),
    attention: attention.slice(0, 10),
    recipients: {
      scope,
      emails: recipients.emails,
      excluded_count: recipients.excludedCount,
    },
  };
}

export async function getEodReportConfig(): Promise<{
  recipient_scope: EodRecipientScope;
  enabled: boolean;
  updated_at: string;
  opt_outs: { member_id: string; full_name: string; email: string }[];
}> {
  const service = createServiceClient();

  const [{ data: config }, { data: optOuts }] = await Promise.all([
    service.from('eod_report_config').select('*').limit(1).maybeSingle(),
    service
      .from('eod_report_opt_outs')
      .select('member_id, team_members(full_name, email)'),
  ]);

  type OptOutRow = {
    member_id: string;
    team_members: { full_name: string; email: string } | { full_name: string; email: string }[] | null;
  };
  const optOutRows: OptOutRow[] = (optOuts ?? []) as OptOutRow[];

  return {
    recipient_scope: (config?.recipient_scope as EodRecipientScope) ?? 'admins_only',
    enabled: config?.enabled ?? true,
    updated_at: config?.updated_at ?? new Date(0).toISOString(),
    opt_outs: optOutRows.map((r) => {
      const tm = Array.isArray(r.team_members) ? r.team_members[0] : r.team_members;
      return {
        member_id: r.member_id,
        full_name: tm?.full_name ?? 'Unknown',
        email: tm?.email ?? '',
      };
    }),
  };
}
