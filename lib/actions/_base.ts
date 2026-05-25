'use server';

import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { IS_DEV_DEMO, getDemoMember } from '@/lib/auth/member';

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
    let actorId: string;
    if (user) {
      actorId = user.id;
    } else if (IS_DEV_DEMO) {
      // Localhost demo (no login) — attribute writes to the demo member.
      actorId = (await getDemoMember()).id;
    } else {
      return { ok: false, error: 'Not authenticated' };
    }

    const service = createServiceClient();

    const data = await params.mutation(actorId);

    // activity_logs.entity_id is a NOT NULL uuid. Some create actions pass a
    // placeholder ('pending', 'self') before the row's id exists — that fails
    // the uuid insert and the log was being lost silently. Resolve a real uuid:
    // prefer the created row's id, then fall back to the actor.
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let entityId = params.entityId;
    if (!UUID_RE.test(entityId)) {
      const resultId = (data as { id?: unknown } | null | undefined)?.id;
      entityId = typeof resultId === 'string' && UUID_RE.test(resultId) ? resultId : actorId;
    }

    // Write activity log (non-blocking — don't fail the mutation if logging
    // fails — but surface the error so audit gaps aren't invisible).
    const { error: logError } = await service.from('activity_logs').insert({
      actor_id: actorId,
      action: params.action,
      entity_type: params.entityType,
      entity_id: entityId,
      asset_id: params.assetId ?? null,
      summary: params.summary,
      diff: params.diff ?? null,
    });
    if (logError) {
      console.error('[withAudit] activity log insert failed:', logError.message);
    }

    return { ok: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return { ok: false, error: message };
  }
}
