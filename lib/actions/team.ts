'use server';

import { createServiceClient } from '@/lib/supabase/service';
import { withAudit } from '@/lib/actions/_base';
import type { ActionResult } from '@/lib/actions/_base';
import { revalidatePath } from 'next/cache';

export async function updateMemberRole(
  memberId: string,
  role: 'admin' | 'member'
): Promise<ActionResult<void>> {
  const result = await withAudit({
    action: 'update',
    entityType: 'team_member',
    entityId: memberId,
    summary: `Role changed to ${role}`,
    mutation: async () => {
      const service = createServiceClient();
      const { error } = await service
        .from('team_members')
        .update({ role })
        .eq('id', memberId);
      if (error) throw new Error(error.message);
    },
  });
  if (result.ok) revalidatePath('/capital-markets/team'); revalidatePath('/sales-marketing/team');
  return result;
}

export async function setMemberActive(
  memberId: string,
  isActive: boolean
): Promise<ActionResult<void>> {
  const result = await withAudit({
    action: 'update',
    entityType: 'team_member',
    entityId: memberId,
    summary: isActive ? 'Member reactivated' : 'Member deactivated',
    mutation: async () => {
      const service = createServiceClient();
      const { error } = await service
        .from('team_members')
        .update({ is_active: isActive })
        .eq('id', memberId);
      if (error) throw new Error(error.message);
    },
  });
  if (result.ok) revalidatePath('/capital-markets/team'); revalidatePath('/sales-marketing/team');
  return result;
}

export async function updateMemberName(
  memberId: string,
  fullName: string
): Promise<ActionResult<void>> {
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
  if (result.ok) revalidatePath('/capital-markets/team'); revalidatePath('/sales-marketing/team');
  return result;
}
