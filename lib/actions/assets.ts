'use server';

import { createServiceClient } from '@/lib/supabase/service';
import { withAudit } from '@/lib/actions/_base';
import { AssetCreateSchema } from '@/lib/schemas/asset';
import type { AssetStatus, AssetTemperature, Asset } from '@/lib/schemas/asset';
import type { ActionResult } from '@/lib/actions/_base';
import { revalidatePath } from 'next/cache';
import { createMilestoneTasks } from '@/lib/actions/tasks';
import { authorizeCmWrite, authorizeAdmin } from '@/lib/rbac';

const CM_FORBIDDEN = 'Forbidden — capital-markets access required' as const;

// Status transition rules (members only — admins can do anything)
const ALLOWED_TRANSITIONS: Record<AssetStatus, AssetStatus[]> = {
  open: ['evaluating', 'dropped'],
  evaluating: ['screened', 'won', 'dropped'],
  screened: ['evaluating', 'won', 'dropped'],
  won: [],
  dropped: ['open'],
};

function canTransition(from: AssetStatus, to: AssetStatus, isAdmin: boolean): boolean {
  if (isAdmin) return true;
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export async function createAsset(formData: FormData): Promise<ActionResult<Asset>> {
  const member = await authorizeCmWrite();
  if (!member) return { ok: false, error: CM_FORBIDDEN };

  const raw = {
    property_name: formData.get('property_name'),
    location: formData.get('location') || null,
    micro_market: formData.get('micro_market') || null,
    status: formData.get('status') || 'open',
    temperature: formData.get('temperature') || 'none',
    asset_type: formData.get('asset_type') || null,
    spoc_agent: formData.get('spoc_agent') || null,
    handover_notes: formData.get('handover_notes') || null,
    plot_size_sqm: formData.get('plot_size_sqm') ? Number(formData.get('plot_size_sqm')) : null,
    fsi_potential: formData.get('fsi_potential') ? Number(formData.get('fsi_potential')) : null,
    regulations: formData.getAll('regulations').map(String).filter(Boolean),
    regulation_notes: formData.get('regulation_notes') || null,
    development_potential_sqm: formData.get('development_potential_sqm') ? Number(formData.get('development_potential_sqm')) : null,
    rehab_area_sqm: formData.get('rehab_area_sqm') ? Number(formData.get('rehab_area_sqm')) : null,
    sale_area_sqm: formData.get('sale_area_sqm') ? Number(formData.get('sale_area_sqm')) : null,
    sale_rate_psf: formData.get('sale_rate_psf') ? Number(formData.get('sale_rate_psf')) : null,
    initial_investment_cr: formData.get('initial_investment_cr') ? Number(formData.get('initial_investment_cr')) : null,
    profit_cr: formData.get('profit_cr') ? Number(formData.get('profit_cr')) : null,
    topline_cr: formData.get('topline_cr') ? Number(formData.get('topline_cr')) : null,
    next_step: formData.get('next_step') || null,
    assigned_to: formData.get('assigned_to') || null,
  };

  const parsed = AssetCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid data' };
  }

  const result = await withAudit({
    action: 'create',
    entityType: 'asset',
    entityId: 'pending',
    summary: `Created asset "${raw.property_name}"`,
    mutation: async (actorId) => {
      const service = createServiceClient();
      const { data, error } = await service
        .from('assets')
        .insert({ ...parsed.data, created_by: actorId, assigned_to: raw.assigned_to ?? null })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as Asset;
    },
  });

  if (result.ok) {
    revalidatePath('/capital-markets/assets');
    if (result.data) await createMilestoneTasks((result.data as { id: string }).id);
  }
  return result;
}

export async function updateAssetStatus(
  assetId: string,
  toStatus: AssetStatus,
  note?: string
): Promise<ActionResult<void>> {
  const member = await authorizeCmWrite();
  if (!member) return { ok: false, error: CM_FORBIDDEN };

  const result = await withAudit({
    action: 'status_change',
    entityType: 'asset',
    entityId: assetId,
    assetId,
    summary: `Status changed to ${toStatus}`,
    mutation: async (actorId) => {
      const service = createServiceClient();

      const { data: asset, error: fetchErr } = await service
        .from('assets')
        .select('status, temperature')
        .eq('id', assetId)
        .single();
      if (fetchErr) throw new Error(fetchErr.message);

      const { data: member } = await service
        .from('team_members')
        .select('role')
        .eq('id', actorId)
        .single();
      const isAdmin = member?.role === 'admin';

      if (!canTransition(asset.status, toStatus, isAdmin)) {
        throw new Error(`Cannot move from ${asset.status} to ${toStatus}`);
      }

      const { error: updateErr } = await service
        .from('assets')
        .update({ status: toStatus, updated_by: actorId })
        .eq('id', assetId);
      if (updateErr) throw new Error(updateErr.message);

      // Record status history
      await service.from('status_history').insert({
        asset_id: assetId,
        from_status: asset.status,
        to_status: toStatus,
        note: note ?? null,
        changed_by: actorId,
      });
    },
  });

  if (result.ok) revalidatePath('/capital-markets/assets');
  return result;
}

export async function updateAssetTemperature(
  assetId: string,
  temperature: AssetTemperature
): Promise<ActionResult<void>> {
  const member = await authorizeCmWrite();
  if (!member) return { ok: false, error: CM_FORBIDDEN };

  const result = await withAudit({
    action: 'update',
    entityType: 'asset',
    entityId: assetId,
    assetId,
    summary: `Temperature changed to ${temperature}`,
    mutation: async (actorId) => {
      const service = createServiceClient();
      const { error } = await service
        .from('assets')
        .update({ temperature, updated_by: actorId })
        .eq('id', assetId);
      if (error) throw new Error(error.message);
    },
  });

  if (result.ok) revalidatePath('/capital-markets/assets');
  return result;
}

export async function updateAssetNextStep(
  assetId: string,
  nextStep: string
): Promise<ActionResult<void>> {
  const member = await authorizeCmWrite();
  if (!member) return { ok: false, error: CM_FORBIDDEN };

  const result = await withAudit({
    action: 'update',
    entityType: 'asset',
    entityId: assetId,
    assetId,
    summary: `Next step updated`,
    mutation: async (actorId) => {
      const service = createServiceClient();
      const { error } = await service
        .from('assets')
        .update({ next_step: nextStep, updated_by: actorId })
        .eq('id', assetId);
      if (error) throw new Error(error.message);
    },
  });

  if (result.ok) revalidatePath('/capital-markets/assets');
  return result;
}

export async function updateAssetFinancials(
  assetId: string,
  fields: {
    initial_investment_cr?: number | null;
    topline_cr?: number | null;
    profit_cr?: number | null;
    sale_rate_psf?: number | null;
    plot_size_sqm?: number | null;
    development_potential_sqm?: number | null;
    rehab_area_sqm?: number | null;
    sale_area_sqm?: number | null;
    fsi_potential?: number | null;
  }
): Promise<ActionResult<void>> {
  const member = await authorizeCmWrite();
  if (!member) return { ok: false, error: CM_FORBIDDEN };

  const result = await withAudit({
    action: 'update',
    entityType: 'asset',
    entityId: assetId,
    assetId,
    summary: 'Feasibility numbers updated',
    mutation: async (actorId) => {
      const service = createServiceClient();
      const { error } = await service
        .from('assets')
        .update({ ...fields, updated_by: actorId })
        .eq('id', assetId);
      if (error) throw new Error(error.message);
    },
  });

  if (result.ok) revalidatePath(`/capital-markets/assets/${assetId}`);
  return result;
}

export async function updateAssetRegulations(
  assetId: string,
  regulations: string[],
  regulationNotes: string | null,
): Promise<ActionResult<void>> {
  const member = await authorizeCmWrite();
  if (!member) return { ok: false, error: CM_FORBIDDEN };

  const result = await withAudit({
    action: 'update',
    entityType: 'asset',
    entityId: assetId,
    assetId,
    summary: 'Regulations updated',
    mutation: async (actorId) => {
      const service = createServiceClient();
      const { error } = await service
        .from('assets')
        .update({ regulations, regulation_notes: regulationNotes, updated_by: actorId })
        .eq('id', assetId);
      if (error) throw new Error(error.message);
    },
  });

  if (result.ok) revalidatePath(`/capital-markets/assets/${assetId}`);
  return result;
}

export async function softDeleteAsset(assetId: string): Promise<ActionResult<void>> {
  const admin = await authorizeAdmin();
  if (!admin) return { ok: false, error: 'Forbidden — admin access required' };

  const result = await withAudit({
    action: 'delete',
    entityType: 'asset',
    entityId: assetId,
    assetId,
    summary: 'Asset soft-deleted',
    mutation: async (actorId) => {
      const service = createServiceClient();
      const { data: member } = await service
        .from('team_members')
        .select('role')
        .eq('id', actorId)
        .single();
      if (member?.role !== 'admin') throw new Error('Only admins can delete assets');

      const { error } = await service
        .from('assets')
        .update({ deleted_at: new Date().toISOString(), deleted_by: actorId })
        .eq('id', assetId);
      if (error) throw new Error(error.message);
    },
  });

  if (result.ok) revalidatePath('/capital-markets/assets');
  return result;
}

export async function searchAssetSuggestions(
  q: string
): Promise<{ id: string; property_name: string }[]> {
  const member = await authorizeCmWrite();
  if (!member) return [];
  if (!q.trim()) return [];
  const service = createServiceClient();
  const { data } = await service
    .from('assets')
    .select('id, property_name')
    .ilike('property_name', `%${q.trim()}%`)
    .is('deleted_at', null)
    .order('property_name', { ascending: true })
    .limit(8);
  return (data ?? []) as { id: string; property_name: string }[];
}

export async function assignAsset(
  assetId: string,
  assignedTo: string | null
): Promise<ActionResult<void>> {
  const member = await authorizeCmWrite();
  if (!member) return { ok: false, error: CM_FORBIDDEN };

  const result = await withAudit({
    action: 'update',
    entityType: 'asset',
    entityId: assetId,
    assetId,
    summary: assignedTo ? `Asset assigned` : `Asset unassigned`,
    mutation: async (actorId) => {
      const service = createServiceClient();
      const { error } = await service
        .from('assets')
        .update({ assigned_to: assignedTo, updated_by: actorId })
        .eq('id', assetId);
      if (error) throw new Error(error.message);
    },
  });
  if (result.ok) {
    revalidatePath('/capital-markets/assets');
    revalidatePath(`/capital-markets/assets/${assetId}`);
  }
  return result;
}
