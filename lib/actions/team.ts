'use server';

import { createServiceClient } from '@/lib/supabase/service';
import { withAudit } from '@/lib/actions/_base';
import type { ActionResult } from '@/lib/actions/_base';
import { revalidatePath } from 'next/cache';
import type { MemberDepartment } from '@/lib/queries/team';
import { authorizeAdmin } from '@/lib/rbac';
import { teamMemberRoleSchema, memberDepartmentSchema } from '@/lib/schemas/team';

function revalidateTeam() {
  revalidatePath('/capital-markets/team');
  revalidatePath('/sales-marketing/team');
}

const FORBIDDEN = 'Forbidden — admin access required' as const;

export async function updateMemberRole(
  memberId: string,
  role: string
): Promise<ActionResult<void>> {
  const actor = await authorizeAdmin();
  if (!actor) return { ok: false, error: FORBIDDEN };

  const parsedRole = teamMemberRoleSchema.safeParse(role);
  if (!parsedRole.success) return { ok: false, error: 'Invalid role' };
  const nextRole = parsedRole.data;

  // Guard against removing the last admin (self-demotion or otherwise).
  if (nextRole !== 'admin') {
    const service = createServiceClient();
    const { data: target } = await service
      .from('team_members')
      .select('role')
      .eq('id', memberId)
      .single();
    if (target?.role === 'admin') {
      const { count } = await service
        .from('team_members')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'admin')
        .eq('is_active', true);
      if ((count ?? 0) <= 1) {
        return { ok: false, error: 'Cannot demote the last active admin' };
      }
    }
  }

  const result = await withAudit({
    action: 'update',
    entityType: 'team_member',
    entityId: memberId,
    summary: `Role changed to ${nextRole}`,
    mutation: async () => {
      const service = createServiceClient();
      const { error } = await service
        .from('team_members')
        .update({ role: nextRole })
        .eq('id', memberId);
      if (error) throw new Error(error.message);
    },
  });
  if (result.ok) revalidateTeam();
  return result;
}

export async function setMemberActive(
  memberId: string,
  isActive: boolean
): Promise<ActionResult<void>> {
  const actor = await authorizeAdmin();
  if (!actor) return { ok: false, error: FORBIDDEN };

  // Prevent self-lockout and removal of the last active admin.
  if (!isActive) {
    if (memberId === actor.id) {
      return { ok: false, error: 'You cannot deactivate your own account' };
    }
    const service = createServiceClient();
    const { data: target } = await service
      .from('team_members')
      .select('role')
      .eq('id', memberId)
      .single();
    if (target?.role === 'admin') {
      const { count } = await service
        .from('team_members')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'admin')
        .eq('is_active', true);
      if ((count ?? 0) <= 1) {
        return { ok: false, error: 'Cannot deactivate the last active admin' };
      }
    }
  }

  const result = await withAudit({
    action: 'update',
    entityType: 'team_member',
    entityId: memberId,
    summary: isActive ? 'Member reactivated' : 'Member deactivated',
    mutation: async () => {
      const service = createServiceClient();
      // Keep status in lockstep with is_active so the offboarded gate + the
      // orphaned-work pool can key off either flag consistently.
      const { error } = await service
        .from('team_members')
        .update({
          is_active: isActive,
          status: isActive ? 'active' : 'deactivated',
        })
        .eq('id', memberId);
      if (error) throw new Error(error.message);
    },
  });
  if (result.ok) revalidateTeam();
  return result;
}

export async function updateMemberDepartment(
  memberId: string,
  department: MemberDepartment
): Promise<ActionResult<void>> {
  const actor = await authorizeAdmin();
  if (!actor) return { ok: false, error: FORBIDDEN };

  const result = await withAudit({
    action: 'update',
    entityType: 'team_member',
    entityId: memberId,
    summary: `Department changed to ${department ?? 'unassigned'}`,
    mutation: async () => {
      const service = createServiceClient();
      const { error } = await service
        .from('team_members')
        .update({ department })
        .eq('id', memberId);
      if (error) throw new Error(error.message);
    },
  });
  if (result.ok) revalidateTeam();
  return result;
}

export async function updateMemberName(
  memberId: string,
  fullName: string
): Promise<ActionResult<void>> {
  const actor = await authorizeAdmin();
  if (!actor) return { ok: false, error: FORBIDDEN };

  const trimmed = fullName.trim();
  if (!trimmed) return { ok: false, error: 'Name cannot be empty' };

  const result = await withAudit({
    action: 'update',
    entityType: 'team_member',
    entityId: memberId,
    summary: `Name updated to "${trimmed}"`,
    mutation: async () => {
      const service = createServiceClient();
      const { error } = await service
        .from('team_members')
        .update({ full_name: trimmed })
        .eq('id', memberId);
      if (error) throw new Error(error.message);
    },
  });
  if (result.ok) revalidateTeam();
  return result;
}

/**
 * Release a quarantined ('pending') member into the app by assigning a role and
 * department in one atomic step. Admin-only. Department must be set (a member
 * with no department has no surface to work in).
 */
export async function activateMember(
  memberId: string,
  role: string,
  department: MemberDepartment
): Promise<ActionResult<void>> {
  const actor = await authorizeAdmin();
  if (!actor) return { ok: false, error: FORBIDDEN };

  const parsedRole = teamMemberRoleSchema.safeParse(role);
  if (!parsedRole.success) return { ok: false, error: 'Invalid role' };

  if (department == null) {
    return { ok: false, error: 'Assign a department to approve this member' };
  }
  const parsedDept = memberDepartmentSchema.safeParse(department);
  if (!parsedDept.success) return { ok: false, error: 'Invalid department' };

  const result = await withAudit({
    action: 'update',
    entityType: 'team_member',
    entityId: memberId,
    summary: `Member approved — role ${parsedRole.data}, department ${parsedDept.data}`,
    mutation: async () => {
      const service = createServiceClient();
      const { error } = await service
        .from('team_members')
        .update({
          role: parsedRole.data,
          department: parsedDept.data,
          status: 'active',
        })
        .eq('id', memberId);
      if (error) throw new Error(error.message);
    },
  });
  if (result.ok) revalidateTeam();
  return result;
}
