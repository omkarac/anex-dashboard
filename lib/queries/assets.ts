import { createClient } from '@/lib/supabase/server';
import { CR_SCALE } from '@/lib/utils/formatters';
import type { Asset } from '@/lib/schemas/asset';

const PAGE_SIZE = 50;

export type SortOption = 'updated_desc' | 'name_asc' | 'name_desc' | 'topline_asc' | 'topline_desc';

export type AssetFilters = {
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
  page?: number;
};

const SORT_MAP: Record<SortOption, { column: string; ascending: boolean }> = {
  updated_desc: { column: 'updated_at', ascending: false },
  name_asc:     { column: 'property_name', ascending: true },
  name_desc:    { column: 'property_name', ascending: false },
  topline_asc:  { column: 'topline_cr', ascending: true },
  topline_desc: { column: 'topline_cr', ascending: false },
};

export async function listAssets(filters: AssetFilters = {}): Promise<{
  assets: Asset[];
  count: number;
  pageCount: number;
  page: number;
}> {
  const supabase = await createClient();
  const page = Math.max(1, filters.page ?? 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { column, ascending } = SORT_MAP[filters.sort ?? 'updated_desc'];

  let query = supabase
    .from('assets')
    .select('*', { count: 'exact' })
    .is('deleted_at', null)
    .order(column, { ascending, nullsFirst: false })
    .range(from, to);

  if (filters.status?.length) query = query.in('status', filters.status);
  if (filters.temperature?.length) query = query.in('temperature', filters.temperature);
  if (filters.asset_type?.length) query = query.in('asset_type', filters.asset_type);
  if (filters.spoc_agent?.length) query = query.in('spoc_agent', filters.spoc_agent);
  if (filters.regulation?.length) query = query.overlaps('regulations', filters.regulation);
  // Filter values arrive in Crore; convert to rupees for the DB query
  if (filters.topline_min != null) query = query.gte('topline_cr', filters.topline_min * CR_SCALE);
  if (filters.topline_max != null) query = query.lte('topline_cr', filters.topline_max * CR_SCALE);
  if (filters.inv_min != null) query = query.gte('initial_investment_cr', filters.inv_min * CR_SCALE);
  if (filters.inv_max != null) query = query.lte('initial_investment_cr', filters.inv_max * CR_SCALE);

  const { data, count, error } = await query;
  if (error) throw error;

  return {
    assets: (data ?? []) as Asset[],
    count: count ?? 0,
    pageCount: Math.ceil((count ?? 0) / PAGE_SIZE),
    page,
  };
}

export async function getAsset(id: string): Promise<Asset | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('assets')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error) return null;
  return data as Asset;
}

export function getAssetNumericBounds(): { topline_max: number; inv_max: number } {
  return { topline_max: 5000, inv_max: 5000 };
}

export async function getDistinctSpocAgents(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('assets')
    .select('spoc_agent')
    .not('spoc_agent', 'is', null)
    .is('deleted_at', null);

  const agents = [...new Set((data ?? []).map((r) => r.spoc_agent as string))];
  return agents.sort();
}
