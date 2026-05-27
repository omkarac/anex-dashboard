'use server';

import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { withAudit } from '@/lib/actions/_base';
import { AssetCreateSchema } from '@/lib/schemas/asset';
import type { AssetStatus, AssetTemperature, Asset } from '@/lib/schemas/asset';
import type { ActionResult } from '@/lib/actions/_base';
import { revalidatePath } from 'next/cache';
import { createMilestoneTasks } from '@/lib/actions/tasks';
import { authorizeCmWrite, authorizeAdmin } from '@/lib/rbac';
import { type SortOption } from '@/lib/queries/assets';
import { getLatestUpdatesForAssets, type LatestUpdateSummary } from '@/lib/queries/updates';
import { getOpenTasksForAssets, getAssetIdsWithOpenTasks, type AssetOpenTask } from '@/lib/queries/developers';
import { IS_DEV_DEMO } from '@/lib/auth/member';

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

// Fast-path search for the asset registry table. Targets ~20ms server-side by
// dropping everything except the name-matched asset rows: no `count: 'exact'`,
// no enrichment joins, no per-keystroke auth round-trip. Capped at 50 results
// so the response payload stays small. Enrichment (latest update, open tasks)
// is fetched in a follow-up call via getAssetEnrichment so it doesn't block
// the visible search response.
export type AssetSearchTableInput = {
  q?: string;
  status?: string[];
  temperature?: string[];
  asset_type?: string[];
  regulation?: string[];
  spoc_agent?: string[];
  sort?: SortOption;
  topline_min?: number;
  topline_max?: number;
  inv_min?: number;
  inv_max?: number;
  plot_min?: number;
  plot_max?: number;
  has_open_tasks?: boolean;
};

const SEARCH_LIMIT = 50;

const SORT_COLUMNS: Record<SortOption, { column: string; ascending: boolean }> = {
  updated_desc: { column: 'updated_at', ascending: false },
  name_asc: { column: 'property_name', ascending: true },
  name_desc: { column: 'property_name', ascending: false },
  topline_asc: { column: 'topline_cr', ascending: true },
  topline_desc: { column: 'topline_cr', ascending: false },
};

export type AssetSearchResult = {
  assets: Asset[];
  // Number of rows actually returned, capped at SEARCH_LIMIT. No exact total —
  // skipping `count: 'exact'` is what keeps this query in the ~10ms range.
  returned: number;
  capped: boolean;
};

export async function searchAssetsForTable(
  input: AssetSearchTableInput
): Promise<AssetSearchResult> {
  const assetIdsWithOpenTasks = input.has_open_tasks
    ? await getAssetIdsWithOpenTasks().catch(() => [])
    : undefined;

  const { column, ascending } = SORT_COLUMNS[input.sort ?? 'updated_desc'];
  // Mirrors lib/queries/assets.ts readClient(): RLS-aware in production,
  // service client in localhost demo so there's data to see without login.
  const supabase = IS_DEV_DEMO ? createServiceClient() : await createClient();

  let query = supabase
    .from('assets')
    .select('*')
    .is('deleted_at', null)
    .order(column, { ascending, nullsFirst: false })
    .limit(SEARCH_LIMIT + 1); // +1 to detect "more than 50 matched"

  if (assetIdsWithOpenTasks) {
    query = query.in('id', assetIdsWithOpenTasks.length ? assetIdsWithOpenTasks : ['__none__']);
  }
  if (input.q?.trim()) query = query.ilike('property_name', `%${input.q.trim()}%`);
  if (input.status?.length) query = query.in('status', input.status);
  if (input.temperature?.length) query = query.in('temperature', input.temperature);
  if (input.asset_type?.length) query = query.in('asset_type', input.asset_type);
  if (input.spoc_agent?.length) query = query.in('spoc_agent', input.spoc_agent);
  if (input.regulation?.length) query = query.overlaps('regulations', input.regulation);
  if (input.topline_min != null) query = query.gte('topline_cr', input.topline_min);
  if (input.topline_max != null) query = query.lte('topline_cr', input.topline_max);
  if (input.inv_min != null) query = query.gte('initial_investment_cr', input.inv_min);
  if (input.inv_max != null) query = query.lte('initial_investment_cr', input.inv_max);
  if (input.plot_min != null) query = query.gte('plot_size_sqm', input.plot_min);
  if (input.plot_max != null) query = query.lte('plot_size_sqm', input.plot_max);

  const { data } = await query;
  const rows = (data ?? []) as Asset[];
  const capped = rows.length > SEARCH_LIMIT;
  const assets = capped ? rows.slice(0, SEARCH_LIMIT) : rows;

  return { assets, returned: assets.length, capped };
}

// Follow-up enrichment for the assets a fast search just surfaced. Called
// after searchAssetsForTable returns; populates the latest-update and
// open-task columns in the background without blocking the search response.
export type AssetEnrichmentResult = {
  latestUpdates: [string, LatestUpdateSummary][];
  openTasks: AssetOpenTask[];
};

export async function getAssetEnrichment(
  assetIds: string[]
): Promise<AssetEnrichmentResult> {
  if (assetIds.length === 0) return { latestUpdates: [], openTasks: [] };
  const [latestUpdates, openTasks] = await Promise.all([
    getLatestUpdatesForAssets(assetIds),
    getOpenTasksForAssets(assetIds),
  ]);
  return { latestUpdates: [...latestUpdates.entries()], openTasks };
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
