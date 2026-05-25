import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { IS_DEV_DEMO } from '@/lib/auth/member';
import type { NeighborhoodStats } from '@/skygauge/api/empirical/types';

// Skygauge NOC data is public AAI information exposed via public-read RLS. In the
// localhost demo there's no auth.uid(), so use the service client (matches the
// assets read pattern); in production anon + RLS is sufficient.
async function readClient() {
  return IS_DEV_DEMO ? createServiceClient() : await createClient();
}

/** Coerce a PostgREST numeric/bigint (number | numeric-string | null) to number|null. */
function num(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Neighborhood empirical summary for a query point via the
 * `noc_neighborhood_stats` RPC (GIST-indexed spatial query). Returns null when
 * the RPC yields no row.
 */
export async function getNeighborhoodStats(
  lat: number,
  lon: number,
  radiusM: number,
): Promise<NeighborhoodStats | null> {
  const sb = await readClient();
  const { data, error } = await sb.rpc('noc_neighborhood_stats', {
    q_lat: lat,
    q_lon: lon,
    radius_m: radiusM,
  });
  if (error) throw new Error(error.message);

  const row = (Array.isArray(data) ? data[0] : data) as
    | Record<string, unknown>
    | null
    | undefined;
  if (!row) return null;

  return {
    total_count: num(row.total_count) ?? 0,
    median_permissible_top: num(row.median_permissible_top),
    min_permissible_top: num(row.min_permissible_top),
    max_permissible_top: num(row.max_permissible_top),
    median_recent_5y: num(row.median_recent_5y),
    most_recent_issue: (row.most_recent_issue as string | null) ?? null,
    restricted_count: num(row.restricted_count) ?? 0,
    appeal_count_within_1km: num(row.appeal_count_within_1km) ?? 0,
  };
}
