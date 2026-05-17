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
  assetId?: string;
  summary: string;
  diff?: { before: unknown; after: unknown };
  mutation: (actorId: string) => Promise<T>;
}): Promise<ActionResult<T>> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: 'Not authenticated' };
    const actorId = user.id;

    const service = createServiceClient();

    const data = await params.mutation(actorId);

    // Write activity log (non-blocking — don't fail the mutation if logging fails)
    await service.from('activity_logs').insert({
      actor_id: actorId,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId,
      asset_id: params.assetId ?? null,
      summary: params.summary,
      diff: params.diff ?? null,
    });

    return { ok: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return { ok: false, error: message };
  }
}
