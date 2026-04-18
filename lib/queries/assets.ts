import { createClient } from '@/lib/supabase/server';
import type { Asset } from '@/lib/schemas/asset';

const PAGE_SIZE = 50;

export type AssetFilters = {
  status?: string[];
  temperature?: string[];
  asset_type?: string[];
  regulation?: string[];
  spoc_agent?: string[];
  page?: number;
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

  let query = supabase
    .from('assets')
    .select('*', { count: 'exact' })
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .range(from, to);

  if (filters.status?.length) query = query.in('status', filters.status);
  if (filters.temperature?.length) query = query.in('temperature', filters.temperature);
  if (filters.asset_type?.length) query = query.in('asset_type', filters.asset_type);
  if (filters.spoc_agent?.length) query = query.in('spoc_agent', filters.spoc_agent);
  if (filters.regulation?.length) query = query.overlaps('regulations', filters.regulation);

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
