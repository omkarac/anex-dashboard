import { createServiceClient } from '@/lib/supabase/service';

export type LogEntry = {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  summary: string;
  created_at: string;
  deleted_at: string | null;
  delete_reason: string | null;
  actor: { full_name: string } | null;
  asset: { id: string; property_name: string } | null;
};

// Entity types per vertical. Expand SM_ENTITY_TYPES as S&M features are built.
export const CM_ENTITY_TYPES = ['asset', 'developer', 'task', 'update', 'developer_share', 'engagement'];
export const SM_ENTITY_TYPES = [
  'sales_project',
  'channel_partner',
  'client',
  'walk_in',
  'site_visit',
  'cp_meeting',
  'eod_report',
  'project_sm_assignment',
];

export type LogFilters = {
  q?: string;
  actor_id?: string;
  action?: string;
  entity_type?: string;
  from?: string;
  to?: string;
  show_deleted?: boolean;
  page?: number;
  vertical?: 'capital_markets' | 'sales_marketing';
};

const PAGE_SIZE = 50;

export async function listLogs(filters: LogFilters = {}): Promise<{
  logs: LogEntry[];
  total: number;
  page: number;
}> {
  const service = createServiceClient();
  const page = filters.page ?? 0;

  // Fetch actor names separately then merge
  function buildQuery(isCount: boolean) {
    let q = service
      .from('activity_logs')
      .select(isCount ? '*' : '*', { count: isCount ? 'exact' : undefined, head: isCount });

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
      // Always exclude CM entity types; restrict to known SM types when available
      if (SM_ENTITY_TYPES.length > 0) {
        q = q.in('entity_type', SM_ENTITY_TYPES);
      } else {
        q = q.not('entity_type', 'in', `(${CM_ENTITY_TYPES.join(',')})`);
      }
    }

    return q.order('created_at', { ascending: false });
  }

  const [countResult, dataResult] = await Promise.all([
    buildQuery(true),
    buildQuery(false).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1),
  ]);

  const total = countResult.count ?? 0;
  const rows = (dataResult.data ?? []) as Omit<LogEntry, 'actor'>[];

  if (rows.length === 0) return { logs: [], total, page };

  // Fetch actor names in one query
  const actorIds = [...new Set(rows.map((r) => r.actor_id).filter(Boolean))] as string[];
  const { data: members } = await service
    .from('team_members')
    .select('id, full_name')
    .in('id', actorIds);

  const memberMap = new Map((members ?? []).map((m) => [m.id, m.full_name]));

  // Resolve asset: prefer asset_id column (new entries), fall back to entity_id for old entries
  // where entity_id stores the asset id directly (asset, update-create, task-create actions)
  const ENTITY_ID_IS_ASSET: Record<string, string[]> = {
    asset: ['create', 'update', 'delete', 'status_change', 'convert'],
    update: ['create'],
    task: ['create'],
    developer_share: ['share'],
  };
  const resolvedAssetIds = rows.map((r) => {
    const fromCol = (r as { asset_id?: string }).asset_id;
    if (fromCol) return fromCol;
    const allowedActions = ENTITY_ID_IS_ASSET[r.entity_type] ?? [];
    if (allowedActions.includes(r.action) && r.entity_id && r.entity_id !== 'pending') {
      return r.entity_id;
    }
    return null;
  });

  const assetIds = [...new Set(resolvedAssetIds.filter(Boolean))] as string[];
  const { data: assetRows } = assetIds.length
    ? await service.from('assets').select('id, property_name').in('id', assetIds)
    : { data: [] };
  const assetMap = new Map((assetRows ?? []).map((a) => [a.id, a.property_name]));

  const logs: LogEntry[] = rows.map((r, i) => {
    const assetId = resolvedAssetIds[i];
    return {
      ...r,
      actor: r.actor_id ? { full_name: memberMap.get(r.actor_id) ?? 'Unknown' } : null,
      asset: assetId && assetMap.has(assetId)
        ? { id: assetId, property_name: assetMap.get(assetId)! }
        : null,
    };
  });

  return { logs, total, page };
}

export async function getLogFilterOptions(vertical?: 'capital_markets' | 'sales_marketing'): Promise<{
  actors: { id: string; full_name: string }[];
  actions: string[];
  entityTypes: string[];
}> {
  const service = createServiceClient();

  let actionQ = service.from('activity_logs').select('action').is('deleted_at', null);
  let entityQ = service.from('activity_logs').select('entity_type').is('deleted_at', null);

  if (vertical === 'capital_markets') {
    actionQ = actionQ.in('entity_type', CM_ENTITY_TYPES);
    entityQ = entityQ.in('entity_type', CM_ENTITY_TYPES);
  } else if (vertical === 'sales_marketing') {
    if (SM_ENTITY_TYPES.length > 0) {
      actionQ = actionQ.in('entity_type', SM_ENTITY_TYPES);
      entityQ = entityQ.in('entity_type', SM_ENTITY_TYPES);
    } else {
      actionQ = actionQ.not('entity_type', 'in', `(${CM_ENTITY_TYPES.join(',')})`);
      entityQ = entityQ.not('entity_type', 'in', `(${CM_ENTITY_TYPES.join(',')})`);
    }
  }

  const [{ data: actorRows }, { data: actionRows }, { data: entityRows }] = await Promise.all([
    service.from('team_members').select('id, full_name').eq('is_active', true).order('full_name'),
    actionQ,
    entityQ,
  ]);

  const actions = [...new Set((actionRows ?? []).map((r: { action: string }) => r.action))].sort();
  const entityTypes = [...new Set((entityRows ?? []).map((r: { entity_type: string }) => r.entity_type))].sort();

  return {
    actors: actorRows ?? [],
    actions,
    entityTypes,
  };
}
