'use server';

import { createServiceClient } from '@/lib/supabase/service';
import { withAudit } from '@/lib/actions/_base';
import type { ActionResult } from '@/lib/actions/_base';
import { revalidatePath } from 'next/cache';
import { DeveloperCreateSchema } from '@/lib/schemas/developer';

export async function createDeveloper(formData: FormData): Promise<ActionResult<void>> {
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

  if (result.ok) revalidatePath('/capital-markets/developers');
  return result;
}

export async function shareWithDeveloper(
  assetId: string,
  developerId: string,
  notes: string
): Promise<ActionResult<void>> {
  const result = await withAudit({
    action: 'share',
    entityType: 'developer_share',
    entityId: assetId,
    assetId,
    summary: `Asset shared with developer`,
    mutation: async (actorId) => {
      const service = createServiceClient();

      const { error } = await service.from('developer_shares').insert({
        asset_id: assetId,
        developer_id: developerId,
        shared_by: actorId,
        notes: notes.trim() || null,
      });
      if (error) throw new Error(error.message);
    },
  });

  if (result.ok) {
    revalidatePath(`/capital-markets/assets/${assetId}`);
    revalidatePath('/capital-markets/developers');
  }
  return result;
}

export async function deleteDeveloper(developerId: string, name: string): Promise<ActionResult<void>> {
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

export async function updateShareOutcome(
  shareId: string,
  assetId: string,
  outcome: string
): Promise<ActionResult<void>> {
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

  if (result.ok) revalidatePath(`/capital-markets/assets/${assetId}`);
  return result;
}
