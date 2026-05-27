'use server';

import { createServiceClient } from '@/lib/supabase/service';
import { withAudit } from '@/lib/actions/_base';
import type { ActionResult } from '@/lib/actions/_base';
import { revalidatePath } from 'next/cache';
import { authorizeCmWrite, authorizeAdmin } from '@/lib/rbac';
import {
  DeveloperCreateSchema,
  DeveloperPreferencesUpsertSchema,
  ShareTaskCreateSchema,
  ShareUpdateCreateSchema,
  ShareWithDeveloperInputSchema,
} from '@/lib/schemas/developer';
import type {
  DeveloperPreferencesUpsert,
  ShareTaskCreate,
  ShareUpdateCreate,
  ShareWithDeveloperInput,
} from '@/lib/schemas/developer';

const CM_FORBIDDEN = 'Forbidden — capital-markets access required' as const;
const ADMIN_FORBIDDEN = 'Forbidden — admin access required' as const;

export async function createDeveloper(formData: FormData): Promise<ActionResult<void>> {
  const member = await authorizeCmWrite();
  if (!member) return { ok: false, error: CM_FORBIDDEN };

  const raw = {
    name: formData.get('name'),
    contact_person: formData.get('contact_person') || null,
    contact_email: formData.get('contact_email') || null,
    contact_phone: formData.get('contact_phone') || null,
    notes: formData.get('notes') || null,
    logo_url: formData.get('logo_url') || null,
  };

  const parsed = DeveloperCreateSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid data' };

  const result = await withAudit({
    action: 'create',
    entityType: 'developer',
    entityId: 'pending',
    summary: `Developer created: ${raw.name}`,
    mutation: async (actorId) => {
      const service = createServiceClient();
      const { error } = await service.from('developers').insert({ ...parsed.data, created_by: actorId });
      if (error) throw new Error(error.message);
    },
  });

  if (result.ok) revalidatePath('/capital-markets/developers');
  return result;
}

export async function updateDeveloper(
  developerId: string,
  data: {
    name: string;
    contact_person: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    notes: string | null;
    logo_url: string | null;
  }
): Promise<ActionResult<void>> {
  const member = await authorizeCmWrite();
  if (!member) return { ok: false, error: CM_FORBIDDEN };

  const result = await withAudit({
    action: 'update',
    entityType: 'developer',
    entityId: developerId,
    summary: `Developer updated: ${data.name}`,
    mutation: async (actorId) => {
      const service = createServiceClient();
      const { error } = await service
        .from('developers')
        .update(data)
        .eq('id', developerId);
      if (error) throw new Error(error.message);
    },
  });

  if (result.ok) {
    revalidatePath('/capital-markets/developers');
    revalidatePath(`/capital-markets/developers/${developerId}`);
  }
  return result;
}

const ALL_ROUTINE_TASKS = [
  { title: 'Share Information Memorandum', task_type: 'im_shared',  priority: 'medium' },
  { title: 'Share Financial Feasibility',  task_type: 'ff_shared',  priority: 'medium' },
  { title: 'Issue EOI',                    task_type: 'eoi_issued', priority: 'high'   },
] as const;

const TASK_COMPLETED_BODY: Record<string, string> = {
  im_shared:  'Information Memorandum shared',
  ff_shared:  'Financial Feasibility shared',
  eoi_issued: 'EOI issued',
};

function dateOnlyToTimestamp(dateOnly: string): string {
  return new Date(`${dateOnly}T12:00:00Z`).toISOString();
}

export async function shareWithDeveloper(
  assetId: string,
  developerId: string,
  input: ShareWithDeveloperInput
): Promise<ActionResult<void>> {
  const member = await authorizeCmWrite();
  if (!member) return { ok: false, error: CM_FORBIDDEN };

  const parsed = ShareWithDeveloperInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid data' };

  const { notes, share_date, selected_tasks } = parsed.data;
  const taskMetaByType = new Map(ALL_ROUTINE_TASKS.map((t) => [t.task_type, t] as const));
  const tasksToCreate = selected_tasks
    .map((s) => {
      const meta = taskMetaByType.get(s.type);
      return meta ? { ...meta, completedAt: dateOnlyToTimestamp(s.date) } : null;
    })
    .filter((t): t is NonNullable<typeof t> => t !== null);

  const result = await withAudit({
    action: 'share',
    entityType: 'developer_share',
    entityId: assetId,
    assetId,
    summary: `Asset shared with developer`,
    mutation: async (actorId) => {
      const service = createServiceClient();

      const sharedAt = share_date ? dateOnlyToTimestamp(share_date) : null;
      const { data: share, error } = await service
        .from('developer_shares')
        .insert({
          asset_id: assetId,
          developer_id: developerId,
          shared_by: actorId,
          notes: notes.trim() || null,
          ...(sharedAt ? { shared_at: sharedAt } : {}),
        })
        .select('id')
        .single();
      if (error) throw new Error(error.message);

      if (tasksToCreate.length === 0) return;

      const { data: insertedTasks, error: tasksError } = await service
        .from('share_tasks')
        .insert(
          tasksToCreate.map((t) => ({
            share_id: share.id,
            title: t.title,
            task_type: t.task_type,
            status: 'done',
            priority: t.priority,
            completed_at: t.completedAt,
            created_by: actorId,
          }))
        )
        .select('id, task_type, completed_at');
      if (tasksError) throw new Error(tasksError.message);

      const updates = (insertedTasks ?? []).map((t) => ({
        share_id:   share.id,
        body:       TASK_COMPLETED_BODY[t.task_type ?? ''] ?? 'Share task completed',
        source:     'task_completed',
        task_id:    t.id,
        created_by: actorId,
        created_at: t.completed_at,
      }));

      if (updates.length > 0) {
        const { error: updatesError } = await service.from('share_updates').insert(updates);
        if (updatesError) throw new Error(updatesError.message);
      }
    },
  });

  if (result.ok) {
    revalidatePath(`/capital-markets/assets/${assetId}`);
    revalidatePath('/capital-markets/developers');
  }
  return result;
}

export async function completeShareTask(
  taskId: string,
  shareId: string,
  taskType: string | null,
  taskTitle: string
): Promise<ActionResult<void>> {
  const member = await authorizeCmWrite();
  if (!member) return { ok: false, error: CM_FORBIDDEN };

  const result = await withAudit({
    action: 'update',
    entityType: 'share_task',
    entityId: taskId,
    summary: `Share task completed: ${taskTitle}`,
    mutation: async (actorId) => {
      const service = createServiceClient();
      const now = new Date().toISOString();

      const { error: taskError } = await service
        .from('share_tasks')
        .update({ status: 'done', completed_at: now, updated_at: now })
        .eq('id', taskId);
      if (taskError) throw new Error(taskError.message);

      const body = taskType ? (TASK_COMPLETED_BODY[taskType] ?? `${taskTitle} completed`) : `${taskTitle} completed`;
      const { error: updateError } = await service.from('share_updates').insert({
        share_id: shareId,
        body,
        source: 'task_completed',
        task_id: taskId,
        created_by: actorId,
      });
      if (updateError) throw new Error(updateError.message);
    },
  });

  if (result.ok) revalidatePath('/capital-markets/developers');
  return result;
}

export async function uncompleteShareTask(
  taskId: string,
): Promise<ActionResult<void>> {
  const member = await authorizeCmWrite();
  if (!member) return { ok: false, error: CM_FORBIDDEN };

  const result = await withAudit({
    action: 'update',
    entityType: 'share_task',
    entityId: taskId,
    summary: `Share task marked incomplete`,
    mutation: async (actorId) => {
      const service = createServiceClient();
      const now = new Date().toISOString();

      const { error: taskError } = await service
        .from('share_tasks')
        .update({ status: 'todo', completed_at: null, updated_at: now })
        .eq('id', taskId);
      if (taskError) throw new Error(taskError.message);

      // Remove the auto-generated update entry that was created on completion
      const { error: updateError } = await service
        .from('share_updates')
        .update({ deleted_at: now, deleted_by: actorId })
        .eq('task_id', taskId)
        .eq('source', 'task_completed')
        .is('deleted_at', null);
      if (updateError) throw new Error(updateError.message);
    },
  });

  if (result.ok) revalidatePath('/capital-markets/developers');
  return result;
}

export async function updateShareTaskFields(
  taskId: string,
  data: { assigned_to?: string | null; due_date?: string | null; priority?: string }
): Promise<ActionResult<void>> {
  const member = await authorizeCmWrite();
  if (!member) return { ok: false, error: CM_FORBIDDEN };

  const result = await withAudit({
    action: 'update',
    entityType: 'share_task',
    entityId: taskId,
    summary: 'Share task updated',
    mutation: async () => {
      const service = createServiceClient();
      const { error } = await service
        .from('share_tasks')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', taskId);
      if (error) throw new Error(error.message);
    },
  });

  if (result.ok) {
    revalidatePath('/capital-markets/developers');
    revalidatePath('/capital-markets/assets');
  }
  return result;
}

export async function createShareTask(
  shareId: string,
  data: ShareTaskCreate
): Promise<ActionResult<void>> {
  const member = await authorizeCmWrite();
  if (!member) return { ok: false, error: CM_FORBIDDEN };

  const parsed = ShareTaskCreateSchema.safeParse(data);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid data' };

  const result = await withAudit({
    action: 'create',
    entityType: 'share_task',
    entityId: shareId,
    summary: `Custom share task created: ${data.title}`,
    mutation: async (actorId) => {
      const service = createServiceClient();
      const { error } = await service.from('share_tasks').insert({
        share_id: shareId,
        title: parsed.data.title,
        task_type: 'custom',
        status: 'todo',
        priority: parsed.data.priority,
        assigned_to: parsed.data.assigned_to ?? null,
        due_date: parsed.data.due_date ?? null,
        created_by: actorId,
      });
      if (error) throw new Error(error.message);
    },
  });

  if (result.ok) revalidatePath('/capital-markets/developers');
  return result;
}

export async function createShareUpdate(
  shareId: string,
  data: ShareUpdateCreate
): Promise<ActionResult<void>> {
  const member = await authorizeCmWrite();
  if (!member) return { ok: false, error: CM_FORBIDDEN };

  const parsed = ShareUpdateCreateSchema.safeParse(data);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid data' };

  const result = await withAudit({
    action: 'create',
    entityType: 'share_update',
    entityId: shareId,
    summary: 'Developer share update added',
    mutation: async (actorId) => {
      const service = createServiceClient();
      const { error } = await service.from('share_updates').insert({
        share_id: shareId,
        body: parsed.data.body,
        source: 'manual',
        created_by: actorId,
      });
      if (error) throw new Error(error.message);
    },
  });

  if (result.ok) revalidatePath('/capital-markets/developers');
  return result;
}

export async function deleteShareUpdate(
  updateId: string,
  shareId: string
): Promise<ActionResult<void>> {
  const admin = await authorizeAdmin();
  if (!admin) return { ok: false, error: ADMIN_FORBIDDEN };

  const result = await withAudit({
    action: 'delete',
    entityType: 'share_update',
    entityId: updateId,
    summary: 'Developer share update deleted',
    mutation: async (actorId) => {
      const service = createServiceClient();
      const { error } = await service
        .from('share_updates')
        .update({ deleted_at: new Date().toISOString(), deleted_by: actorId })
        .eq('id', updateId);
      if (error) throw new Error(error.message);
    },
  });

  if (result.ok) revalidatePath('/capital-markets/developers');
  return result;
}

export async function deleteDeveloper(developerId: string, name: string): Promise<ActionResult<void>> {
  const admin = await authorizeAdmin();
  if (!admin) return { ok: false, error: ADMIN_FORBIDDEN };

  const result = await withAudit({
    action: 'delete',
    entityType: 'developer',
    entityId: developerId,
    summary: `Developer deleted: ${name}`,
    mutation: async () => {
      const service = createServiceClient();
      const { error } = await service
        .from('developers')
        .update({ is_active: false })
        .eq('id', developerId);
      if (error) throw new Error(error.message);
    },
  });

  if (result.ok) revalidatePath('/capital-markets/developers');
  return result;
}

export async function updateShareNotes(
  shareId: string,
  assetId: string,
  notes: string | null
): Promise<ActionResult<void>> {
  const member = await authorizeCmWrite();
  if (!member) return { ok: false, error: CM_FORBIDDEN };

  const result = await withAudit({
    action: 'update',
    entityType: 'developer_share',
    entityId: shareId,
    assetId,
    summary: `Share notes updated`,
    mutation: async () => {
      const service = createServiceClient();
      const { error } = await service
        .from('developer_shares')
        .update({ notes })
        .eq('id', shareId);
      if (error) throw new Error(error.message);
    },
  });

  if (result.ok) revalidatePath('/capital-markets/developers');
  return result;
}

export async function upsertDeveloperPreferences(
  developerId: string,
  data: DeveloperPreferencesUpsert
): Promise<ActionResult<void>> {
  const member = await authorizeCmWrite();
  if (!member) return { ok: false, error: CM_FORBIDDEN };

  const parsed = DeveloperPreferencesUpsertSchema.safeParse(data);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid data' };

  const result = await withAudit({
    action: 'update',
    entityType: 'developer',
    entityId: developerId,
    summary: 'Developer appetite profile updated',
    mutation: async (actorId) => {
      const service = createServiceClient();
      const { error } = await service
        .from('developer_preferences')
        .upsert(
          {
            developer_id: developerId,
            ...parsed.data,
            updated_at: new Date().toISOString(),
            updated_by: actorId,
          },
          { onConflict: 'developer_id' }
        );
      if (error) throw new Error(error.message);
    },
  });

  if (result.ok) {
    revalidatePath('/capital-markets/developers');
    revalidatePath(`/capital-markets/developers/${developerId}`);
  }
  return result;
}

export async function updateShareOutcome(
  shareId: string,
  assetId: string,
  outcome: string
): Promise<ActionResult<void>> {
  const member = await authorizeCmWrite();
  if (!member) return { ok: false, error: CM_FORBIDDEN };

  const result = await withAudit({
    action: 'update',
    entityType: 'developer_share',
    entityId: shareId,
    assetId,
    summary: `Share outcome updated: ${outcome}`,
    mutation: async (actorId) => {
      const service = createServiceClient();
      const { error } = await service
        .from('developer_shares')
        .update({ outcome, outcome_at: new Date().toISOString() })
        .eq('id', shareId);
      if (error) throw new Error(error.message);
    },
  });

  if (result.ok) {
    revalidatePath(`/capital-markets/assets/${assetId}`);
    revalidatePath('/capital-markets/developers');
    revalidatePath('/capital-markets/assets');
  }
  return result;
}
