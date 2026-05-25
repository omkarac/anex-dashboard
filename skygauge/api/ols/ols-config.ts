/**
 * ICAO Annex 14 Vol. I — Obstacle Limitation Surface parameters.
 *
 * Tables 4-1 (approach runways) and 4-2 (take-off climb) condensed into typed
 * configuration objects, keyed by ICAO aerodrome reference code (1–4) and a
 * precision-approach flag.
 *
 * All distances metres, all slopes as decimal fractions (e.g. 0.02 = 2 %).
 *
 * References:
 *   - ICAO Annex 14, Volume I, "Aerodrome Design and Operations", 9th edition.
 *   - AAI eAIP India / CCZM publication for MMR-specific notes.
 */

/** One linear section of the approach surface. */
export interface ApproachSection {
  /** Length of this section along the surface's centerline, metres. */
  readonly length_m: number;
  /** Vertical slope, decimal fraction (e.g. 0.02 = 2 %). */
  readonly slope: number;
}

/** Approach surface geometry, per Annex 14 §4.1.18 + Table 4-1. */
export interface ApproachConfig {
  /** Half of the inner edge width, metres. (Table 4-1 "Length of inner edge".) */
  readonly inner_edge_half_width_m: number;
  /** Distance from threshold to the inner edge, metres. (Always 60 m in Annex 14 Table 4-1.) */
  readonly distance_from_threshold_m: number;
  /** Divergence per side, decimal (e.g. 0.15 = 15 %). */
  readonly divergence: number;
  /** Sequential sections — height rises by `length * slope` per section. */
  readonly sections: readonly ApproachSection[];
}

/** Take-off climb surface geometry, per Annex 14 §4.1.29 + Table 4-2. */
export interface TakeoffConfig {
  readonly inner_edge_half_width_m: number;
  /** Distance from runway end to the inner edge, metres. */
  readonly distance_from_runway_end_m: number;
  readonly divergence: number;
  readonly length_m: number;
  readonly slope: number;
}

/** Complete OLS surface parameter set for one runway code+type. */
export interface OLSConfig {
  readonly label: string;

  // Airport-level surfaces (referenced to airport elevation).
  readonly ihs_radius_m: number;
  readonly ihs_height_m: number;
  readonly conical_slope: number;
  /** Total height above airport elevation at the OUTER edge of the conical. */
  readonly conical_max_height_m: number;
  readonly ohs_radius_m: number;
  readonly ohs_height_m: number;

  // Per-runway surfaces.
  readonly approach: ApproachConfig;
  readonly takeoff_climb: TakeoffConfig;
  /** Transitional surface slope, decimal (e.g. 1/7 ≈ 0.1429 = 14.3 %). */
  readonly transitional_slope: number;
  /** Half of the strip width — transitional surfaces start at the strip edge. */
  readonly strip_half_width_m: number;
}

// ---------------------------------------------------------------------------
// Code 4, precision-approach (CSMIA, NMIA) — Table 4-1 col. "Precision approach 3 or 4"
// ---------------------------------------------------------------------------

export const CONFIG_CODE_4_PA: OLSConfig = {
  label: "Code 4 / Precision Approach",
  ihs_radius_m: 4000,
  ihs_height_m: 45,
  conical_slope: 0.05,
  conical_max_height_m: 145, // 45 (IHS) + 100 (conical) above airport elev
  ohs_radius_m: 15000,
  ohs_height_m: 150,
  approach: {
    inner_edge_half_width_m: 150, // inner edge 300 m wide
    distance_from_threshold_m: 60,
    divergence: 0.15,
    sections: [
      { length_m: 3000, slope: 0.02 },
      { length_m: 3600, slope: 0.025 },
      { length_m: 8400, slope: 0 }, // horizontal section
    ],
  },
  takeoff_climb: {
    inner_edge_half_width_m: 90, // inner edge 180 m wide
    distance_from_runway_end_m: 60,
    divergence: 0.125,
    length_m: 15000,
    slope: 0.02,
  },
  transitional_slope: 1 / 7, // ≈ 0.1429 (14.3 %)
  strip_half_width_m: 150, // 300 m strip width for Code 3-4 precision
};

// ---------------------------------------------------------------------------
// Code 2, non-precision (Juhu RWY 08/26) — Table 4-1 col. "Non-precision 1 or 2"
// (Code 2 specifics from §3.4 + Tables 3-1, 4-1.)
// ---------------------------------------------------------------------------

export const CONFIG_CODE_2_NPA: OLSConfig = {
  label: "Code 2 / Non-Precision Approach",
  ihs_radius_m: 2500,
  ihs_height_m: 45,
  conical_slope: 0.05,
  conical_max_height_m: 100, // 45 + 55
  ohs_radius_m: 15000,
  ohs_height_m: 150,
  approach: {
    inner_edge_half_width_m: 80, // inner edge 160 m wide
    distance_from_threshold_m: 60,
    divergence: 0.15,
    sections: [
      { length_m: 2500, slope: 0.025 },
      { length_m: 12500, slope: 0 }, // horizontal continuation to 15 km
    ],
  },
  takeoff_climb: {
    inner_edge_half_width_m: 40, // inner edge 80 m wide
    distance_from_runway_end_m: 60,
    divergence: 0.10,
    length_m: 2500,
    slope: 0.04,
  },
  transitional_slope: 1 / 5, // 20 %
  strip_half_width_m: 75, // 150 m strip for Code 2
};

// ---------------------------------------------------------------------------
// Code 1, non-precision (Juhu RWY 03/21, very short) — Table 4-1 col. "Non-instrument 1"
// ---------------------------------------------------------------------------

export const CONFIG_CODE_1_NPA: OLSConfig = {
  label: "Code 1 / Non-Instrument",
  ihs_radius_m: 2000,
  ihs_height_m: 45,
  conical_slope: 0.05,
  conical_max_height_m: 80, // 45 + 35
  ohs_radius_m: 15000,
  ohs_height_m: 150,
  approach: {
    inner_edge_half_width_m: 60, // inner edge 120 m wide
    distance_from_threshold_m: 30, // 30 m for Code 1
    divergence: 0.10,
    sections: [
      { length_m: 1600, slope: 0.05 },
      { length_m: 13400, slope: 0 },
    ],
  },
  takeoff_climb: {
    inner_edge_half_width_m: 30, // inner edge 60 m wide
    distance_from_runway_end_m: 30,
    divergence: 0.10,
    length_m: 1600,
    slope: 0.05,
  },
  transitional_slope: 1 / 5,
  strip_half_width_m: 40, // 80 m strip
};

/** Pick the right config for a runway, given its code + precision flag. */
export function configForRunway(code: 1 | 2 | 3 | 4, precision: boolean): OLSConfig {
  if (code >= 3) return CONFIG_CODE_4_PA; // we treat 3 and 4 alike (Table 4-1 groups them)
  if (code === 2) return CONFIG_CODE_2_NPA;
  return precision ? CONFIG_CODE_2_NPA : CONFIG_CODE_1_NPA;
}

/**
 * Pick the AIRPORT-level config — the most restrictive runway governs the
 * airport-wide IHS/Conical/OHS. (Per Annex 14 §4.1.5: "The dimensions of the
 * obstacle limitation surfaces shall be those specified … as appropriate for
 * the type of runway intended to be served." For the airport-wide surfaces,
 * the largest applicable code dominates.)
 */
export function airportConfig(
  runways: ReadonlyArray<{ code: 1 | 2 | 3 | 4; precision_approach: boolean }>,
): OLSConfig {
  let best: OLSConfig = CONFIG_CODE_1_NPA;
  for (const r of runways) {
    const cfg = configForRunway(r.code, r.precision_approach);
    if (cfg.ihs_radius_m > best.ihs_radius_m) best = cfg;
  }
  return best;
}
