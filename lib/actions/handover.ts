'use server';

import { createServiceClient } from '@/lib/supabase/service';
import { withAudit, type ActionResult } from '@/lib/actions/_base';
import {
  currentUser,
  isAdmin,
  hasCmAccess,
  isSalesRole,
  canAccessProject,
} from '@/lib/rbac';
import { revalidatePath } from 'next/cache';
import type { OrphanedKind } from '@/lib/queries/orphaned';

const TARGET: Record<OrphanedKind, { table: string; column: string; entityType: string }> = {
  task: { table: 'tasks', column: 'assigned_to', entityType: 'task' },
  asset: { table: 'assets', column: 'assigned_to', entityType: 'asset' },
  follow_up: { table: 'follow_up_tasks', column: 'assigned_to', entityType: 'follow_up_task' },
  lead: { table: 'leads', column: 'assigned_presales_id', entityType: 'lead' },
};

/**
 * Reassign or self-claim a piece of orphaned (offboarded-owner) work.
 *
 * Authorization:
 *  - admins may reassign any item to any active member;
 *  - everyone else may only self-claim, and only within their own vertical
 *    (CM access for task/asset; sales role + project scope for follow_up/lead).
 */
export async function reassignOrphanedItem(params: {
  kind: OrphanedKind;
  id: string;
  toMemberId: string;
  projectId?: string | null;
}): Promise<ActionResult<void>> {
  const actor = await currentUser();
  const { kind, id, toMemberId, projectId } = params;

  const cfg = TARGET[kind];
  if (!cfg) return { ok: false, error: 'Unknown item type' };

  const claimingSelf = toMemberId === actor.id;

  if (!isAdmin(actor)) {
    if (!claimingSelf) {
      return { ok: false, error: 'Only an admin can reassign work to someone else' };
    }
    if (kind === 'task' || kind === 'asset') {
      if (!hasCmAccess(actor)) {
        return { ok: false, error: 'Capital-markets access required to claim this' };
      }
    } else {
      if (!isSalesRole(actor)) {
        return { ok: false, error: 'Sales access required to claim this' };
      }
      if (!(await canAccessProject(actor, projectId))) {
        return { ok: false, error: 'You are not assigned to this item’s project' };
      }
    }
  }

  const service = createServiceClient();

  // The new owner must be an active member.
  const { data: target } = await service
    .from('team_members')
    .select('full_name, status, is_active')
    .eq('id', toMemberId)
    .single();
  if (!target || !target.is_active || target.status !== 'active') {
    return { ok: false, error: 'Pick an active team member' };
  }

  const result = await withAudit({
    action: 'update',
    entityType: cfg.entityType,
    entityId: id,
    summary: `Handover — ${kind.replace('_', ' ')} reassigned to ${target.full_name}`,
    mutation: async () => {
      const { error } = await service
        .from(cfg.table)
        .update({ [cfg.column]: toMemberId })
        .eq('id', id);
      if (error) throw new Error(error.message);
    },
  });

  if (result.ok) {
    revalidatePath('/capital-markets/team');
    revalidatePath('/sales-marketing/team');
  }
  return result;
}
