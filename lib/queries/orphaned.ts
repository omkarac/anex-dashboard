import { createServiceClient } from '@/lib/supabase/service';

// A unit of work whose owner has been offboarded (deactivated). Surfaced
// team-wide so a manager can reassign it and teammates can self-claim it.
export type OrphanedKind = 'task' | 'asset' | 'follow_up' | 'lead';

export type OrphanedItem = {
  kind: OrphanedKind;
  id: string;
  title: string;
  subtitle: string | null;
  formerOwnerId: string;
  formerOwnerName: string;
  href: string | null;
  // CM task reassignment needs the asset id; sales items carry their project.
  assetId: string | null;
  projectId: string | null;
};

const TASK_TYPE_LABELS: Record<string, string> = {
  follow_up_call: 'Follow-up call',
  site_visit: 'Site visit',
  callback: 'Callback',
};

/**
 * All open work still owned by offboarded members. "Open" excludes terminal
 * states so the pool only shows work that genuinely needs a new owner.
 */
export async function getOrphanedWork(): Promise<OrphanedItem[]> {
  const service = createServiceClient();

  const { data: gone } = await service
    .from('team_members')
    .select('id, full_name')
    .or('status.eq.deactivated,is_active.eq.false');

  const owners = new Map((gone ?? []).map((m) => [m.id, m.full_name as string]));
  const ids = [...owners.keys()];
  if (ids.length === 0) return [];

  const ownerName = (id: string | null) =>
    (id && owners.get(id)) || 'Former member';

  const [tasks, assets, followUps, leads] = await Promise.all([
    service
      .from('tasks')
      .select('id, title, asset_id, assigned_to, assets(property_name)')
      .in('assigned_to', ids)
      .is('deleted_at', null)
      .not('status', 'in', '("done","cancelled")'),
    service
      .from('assets')
      .select('id, property_name, assigned_to')
      .in('assigned_to', ids)
      .is('deleted_at', null)
      .not('status', 'in', '("dropped","won")'),
    service
      .from('follow_up_tasks')
      .select('id, task_type, assigned_to, project_id:leads(project_id), wi:walk_ins(project_id)')
      .in('assigned_to', ids)
      .in('status', ['pending', 'missed', 'snoozed']),
    service
      .from('leads')
      .select('id, first_name, last_name, project_id, assigned_presales_id')
      .in('assigned_presales_id', ids)
      .eq('is_active', true),
  ]);

  const items: OrphanedItem[] = [];

  for (const t of tasks.data ?? []) {
    const assetName = (t.assets as unknown as { property_name: string } | null)?.property_name ?? null;
    items.push({
      kind: 'task',
      id: t.id,
      title: t.title,
      subtitle: assetName,
      formerOwnerId: t.assigned_to as string,
      formerOwnerName: ownerName(t.assigned_to as string),
      href: t.asset_id ? `/capital-markets/assets/${t.asset_id}` : null,
      assetId: (t.asset_id as string) ?? null,
      projectId: null,
    });
  }

  for (const a of assets.data ?? []) {
    items.push({
      kind: 'asset',
      id: a.id,
      title: a.property_name,
      subtitle: 'Asset SPOC',
      formerOwnerId: a.assigned_to as string,
      formerOwnerName: ownerName(a.assigned_to as string),
      href: `/capital-markets/assets/${a.id}`,
      assetId: a.id,
      projectId: null,
    });
  }

  for (const f of followUps.data ?? []) {
    const leadProject = (f.project_id as unknown as { project_id: string } | null)?.project_id ?? null;
    const wiProject = (f.wi as unknown as { project_id: string } | null)?.project_id ?? null;
    items.push({
      kind: 'follow_up',
      id: f.id,
      title: TASK_TYPE_LABELS[f.task_type as string] ?? 'Follow-up task',
      subtitle: 'Sales follow-up',
      formerOwnerId: f.assigned_to as string,
      formerOwnerName: ownerName(f.assigned_to as string),
      href: '/sales/tasks',
      assetId: null,
      projectId: leadProject ?? wiProject,
    });
  }

  for (const l of leads.data ?? []) {
    const name = [l.first_name, l.last_name].filter(Boolean).join(' ') || 'Lead';
    items.push({
      kind: 'lead',
      id: l.id,
      title: name,
      subtitle: 'Sales lead',
      formerOwnerId: l.assigned_presales_id as string,
      formerOwnerName: ownerName(l.assigned_presales_id as string),
      href: '/sales/leads',
      assetId: null,
      projectId: (l.project_id as string) ?? null,
    });
  }

  return items;
}
