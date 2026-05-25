/**
 * Skygauge empirical layer — type definitions.
 *
 * The empirical layer answers "what are AAI *actually* approving near here?" by
 * summarising issued NOCs in the neighborhood. It complements the theoretical
 * OLS ceiling: the engine says what the geometry permits, the empirical band
 * says what the real-world approvals look like, and the delta between them is
 * the actionable insight.
 *
 * All elevations are metres AMSL. Pure types — no runtime, no deps.
 */

/** Raw return of the `noc_neighborhood_stats` Postgres RPC (one row). */
export interface NeighborhoodStats {
  /** NOCs within the radius that have a parsed permissible top. */
  readonly total_count: number;
  /** Median permissible top across all matched NOCs, m AMSL. */
  readonly median_permissible_top: number | null;
  readonly min_permissible_top: number | null;
  readonly max_permissible_top: number | null;
  /** Median restricted to NOCs issued in the last 5 years (recency-weighted). */
  readonly median_recent_5y: number | null;
  /** ISO date of the most recent matched NOC, or null. */
  readonly most_recent_issue: string | null;
  /** How many matched NOCs were flagged restricted (conditional approval). */
  readonly restricted_count: number;
  /** Appellate cases within 1 km — overrides to the standard OLS. */
  readonly appeal_count_within_1km: number;
}

/** A nearby issued NOC point (subset of the `nearby_nocs` RPC) — for the 3D scene. */
export interface NearbyNoc {
  readonly noc_id: string | null;
  readonly lat: number | null;
  readonly lon: number | null;
  /** Distance from the query point, metres. */
  readonly distance_m: number;
  /** Permissible top, m AMSL (null when unparsed). */
  readonly permissible_top_m: number | null;
  readonly is_restricted: boolean;
}

/** A nearby appellate-committee case (subset of the `nearby_appeals` RPC). */
export interface NearbyAppeal {
  readonly noc_id: string | null;
  readonly lat: number | null;
  readonly lon: number | null;
  /** Distance from the query point, metres. */
  readonly distance_m: number;
  /** ISO meeting date. */
  readonly meeting_date: string | null;
  /** Committee-approved top, m AMSL (may be null when "not specified"). */
  readonly approved_top_m: number | null;
  readonly pdf_url: string | null;
}

/** Which median the band is reporting. */
export type MedianBasis = 'recent_5y' | 'all_time';

/** Processed empirical band, ready for the result panel. */
export interface EmpiricalBand {
  /** Number of nearby NOCs the band is built from. */
  readonly sampleCount: number;
  /** Reported median permissible top (recency-weighted when available), m AMSL. */
  readonly median: number | null;
  /** Whether `median` is the recent-5y figure or the all-time fallback. */
  readonly medianBasis: MedianBasis | null;
  readonly min: number | null;
  readonly max: number | null;
  readonly mostRecentIssue: string | null;
  /** Fraction of nearby NOCs that were restricted, 0–1. */
  readonly restrictedShare: number | null;
  readonly appealCount: number;
  /** The theoretical OLS ceiling this band is compared against, m AMSL. */
  readonly theoreticalAmsl: number | null;
  /** Empirical median − theoretical ceiling, m. Negative = approvals sit below
   *  the OLS ceiling; positive = relief granted above it. Null if either side
   *  is unknown. */
  readonly deltaM: number | null;
}
