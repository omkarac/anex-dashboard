'use server';

import { createServiceClient } from '@/lib/supabase/service';
import { withAudit } from '@/lib/actions/_base';
import type { ActionResult } from '@/lib/actions/_base';
import { revalidatePath } from 'next/cache';

export async function updateProfile(data: {
  full_name: string;
  title: string | null;
  phone: string | null;
}): Promise<ActionResult<void>> {
  const result = await withAudit({
    action: 'update',
    entityType: 'team_member',
    entityId: 'self',
    summary: 'Profile updated',
    mutation: async (actorId) => {
      const service = createServiceClient();
      const { error } = await service
        .from('team_members')
        .update({ full_name: data.full_name, title: data.title, phone: data.phone })
        .eq('id', actorId);
      if (error) throw new Error(error.message);
    },
  });

  if (result.ok) revalidatePath('/profile');
  return result;
}
