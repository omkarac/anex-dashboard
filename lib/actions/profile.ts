'use server';

import { createServiceClient } from '@/lib/supabase/service';
import { withAudit } from '@/lib/actions/_base';
import type { ActionResult } from '@/lib/actions/_base';
import { revalidatePath } from 'next/cache';

export async function updateProfile(data: {
  full_name: string;
  title: string | null;
  phone: string | null;
  avatar_url?: string | null;
  banner_color?: string | null;
}): Promise<ActionResult<void>> {
  const result = await withAudit({
    action: 'update',
    entityType: 'team_member',
    entityId: 'self',
    summary: 'Profile updated',
    mutation: async (actorId) => {
      const service = createServiceClient();
      const patch: Record<string, unknown> = {
        full_name: data.full_name,
        title: data.title,
        phone: data.phone,
      };
      if ('avatar_url' in data) patch.avatar_url = data.avatar_url;
      if ('banner_color' in data) patch.banner_color = data.banner_color;
      const { error } = await service
        .from('team_members')
        .update(patch)
        .eq('id', actorId);
      if (error) throw new Error(error.message);
    },
  });

  if (result.ok) revalidatePath('/profile');
  return result;
}
