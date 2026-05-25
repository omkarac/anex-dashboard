/**
 * Skygauge empirical layer — band builder.
 *
 * Pure transform from the raw `noc_neighborhood_stats` RPC row into the
 * `EmpiricalBand` the UI renders, including the theoretical-vs-empirical delta.
 * No deps; runs anywhere.
 */

import type { EmpiricalBand, MedianBasis, NeighborhoodStats } from './types.ts';

/**
 * Build the empirical band from neighborhood stats and the theoretical OLS
 * ceiling. Prefers the recency-weighted (last-5-years) median when present,
 * falling back to the all-time median.
 */
export function buildEmpiricalBand(
  stats: NeighborhoodStats,
  theoreticalAmsl: number | null,
): EmpiricalBand {
  let median: number | null = null;
  let medianBasis: MedianBasis | null = null;
  if (stats.median_recent_5y !== null) {
    median = stats.median_recent_5y;
    medianBasis = 'recent_5y';
  } else if (stats.median_permissible_top !== null) {
    median = stats.median_permissible_top;
    medianBasis = 'all_time';
  }

  const restrictedShare =
    stats.total_count > 0 ? stats.restricted_count / stats.total_count : null;

  const deltaM =
    median !== null && theoreticalAmsl !== null ? median - theoreticalAmsl : null;

  return {
    sampleCount: stats.total_count,
    median,
    medianBasis,
    min: stats.min_permissible_top,
    max: stats.max_permissible_top,
    mostRecentIssue: stats.most_recent_issue,
    restrictedShare,
    appealCount: stats.appeal_count_within_1km,
    theoreticalAmsl,
    deltaM,
  };
}
