/**
 * Skygauge OLS engine — type definitions.
 *
 * The OLS (Obstacle Limitation Surfaces) engine is a pure function from
 * (lat, lon, optional site elevation) to a maximum permissible top elevation
 * above mean sea level, derived from ICAO Annex 14 surfaces around the
 * relevant airport(s).
 *
 * All elevations are metres AMSL. All lat/lon are decimal degrees.
 * All distances are metres. All angles are degrees (compass, 0–360°).
 *
 * The engine operates in a local horizontal plane around each ARP — the
 * Earth's curvature is approximated via great-circle (spherical) geometry.
 * Within the ~30 km OLS footprint, the error vs. WGS-84 is well under 1 m
 * — far below the precision of the surfaces themselves.
 */

/** A point on the Earth's surface — decimal degrees. */
export interface LatLon {
  readonly lat: number;
  readonly lon: number;
}

/** A point with a known ground elevation AMSL. */
export interface SitePoint extends LatLon {
  /** Ground elevation at the site, in metres AMSL. Required for AGL height
   *  output; if omitted, the engine reports only AMSL. */
  readonly elevation_m?: number;
}

/** One end of a runway. */
export interface RunwayThreshold {
  readonly name: string; // e.g. "09", "27"
  readonly lat: number;
  readonly lon: number;
  /** Threshold elevation, metres AMSL. */
  readonly elev_m: number;
}

/** A runway, encoded as a pair of thresholds + geometry. */
export interface Runway {
  /** Conventional designator, e.g. "09/27". */
  readonly designator: string;
  readonly threshold_a: RunwayThreshold;
  readonly threshold_b: RunwayThreshold;
  readonly length_m: number;
  readonly width_m: number;
  /** True bearing from threshold_a to threshold_b, degrees. */
  readonly true_bearing: number;
  /** ICAO aerodrome reference code 1–4 (length-based, see Annex 14 §1.6). */
  readonly code: 1 | 2 | 3 | 4;
  /** Precision-approach (instrument landing system available). Affects
   *  approach-surface slopes per Table 4-1. */
  readonly precision_approach: boolean;
}

/** An aerodrome with one or more runways. */
export interface Airport {
  /** ICAO 4-letter code (e.g. VABB, VAJJ, VANM). */
  readonly code: string;
  readonly name: string;
  readonly arp: LatLon;
  /** Aerodrome elevation AMSL — the reference for IHS/Conical/OHS. */
  readonly elevation_m: number;
  readonly runways: readonly Runway[];
}

/** The kinds of OLS surfaces the engine evaluates. */
export type SurfaceKind =
  | "inner_horizontal"
  | "conical"
  | "outer_horizontal"
  | "approach"
  | "takeoff_climb"
  | "transitional";

/** A single (airport, surface) constraint at the query point. */
export interface SurfaceHit {
  readonly surface: SurfaceKind;
  readonly airport_code: string;
  /** Designator of the runway this surface belongs to (per-runway surfaces only). */
  readonly runway_designator?: string;
  /** Threshold the surface references (approach / takeoff / transitional only). */
  readonly threshold_name?: string;
  /** The maximum top elevation AMSL allowed by this surface at the query point. */
  readonly max_top_amsl_m: number;
  /** Height of the surface above its origin (airport elevation or threshold
   *  elevation, depending on surface kind). Useful for explanations. */
  readonly surface_height_above_origin_m: number;
  /** Distance from the query point to the surface's reference point, metres.
   *  For airport-wide surfaces this is the distance to the ARP; for per-runway
   *  surfaces, the distance to the relevant threshold or runway centerline. */
  readonly distance_to_origin_m: number;
}

/** The engine's final answer. */
export interface OLSResult {
  /** The binding (most restrictive) surface, or null if no surface constrains
   *  the point (i.e. outside every airport's outer horizontal footprint). */
  readonly binding: SurfaceHit | null;
  /** Max top elevation AMSL allowed at the site. null means unconstrained. */
  readonly max_top_amsl_m: number | null;
  /** Max height above the ground, computed from siteElev when provided. */
  readonly max_height_agl_m?: number;
  /** Every surface that "saw" the query point, ordered by max_top_amsl_m ascending.
   *  Useful for UI explanations: "Conical surface; if you moved 200 m further
   *  out, Outer Horizontal would take over at +12 m." */
  readonly all_hits: readonly SurfaceHit[];
}
