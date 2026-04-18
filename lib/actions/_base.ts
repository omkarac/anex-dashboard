'use server';

import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'status_change'
  | 'share'
  | 'convert';

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function withAudit<T>(params: {
  action: AuditAction;
  entityType: string;
  entityId: string;
  summary: string;
  diff?: { before: unknown; after: unknown };
  mutation: (actorId: string) => Promise<T>;
}): Promise<ActionResult<T>> {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { ok: false, error: 'Not authenticated' };

    const actorId = session.user.id;

    // Ensure team_members row exists
    const service = createServiceClient();
    await service.from('team_members').upsert(
      {
        id: actorId,
        full_name: session.user.email?.split('@')[0] ?? 'User',
        email: session.user.email!,
        role: 'member',
        is_active: true,
      },
      { onConflict: 'id', ignoreDuplicates: true }
    );

    const data = await params.mutation(actorId);

    // Write activity log (non-blocking — don't fail the mutation if logging fails)
    await service.from('activity_logs').insert({
      actor_id: actorId,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId,
      summary: params.summary,
      diff: params.diff ?? null,
    });

    return { ok: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return { ok: false, error: message };
  }
}
