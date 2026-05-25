/**
 * ICAO Annex 14 Obstacle Limitation Surface evaluators.
 *
 * Each `eval*` function takes the query point and returns the constraint that
 * surface imposes at that point, or `null` if the point falls outside the
 * surface's footprint. The engine collects all hits across all airports and
 * surfaces, then takes the minimum `max_top_amsl_m` as the binding constraint.
 *
 * Coordinate model
 * ----------------
 * Per-runway surfaces are evaluated by projecting the query point onto the
 * runway's longitudinal axis (using `alongTrackDistanceM` along the great
 * circle through the two thresholds) and its perpendicular (cross-track).
 * Within the OLS footprint (<15 km from any threshold), this is accurate to
 * sub-metre vs. an ENU local tangent plane.
 *
 * Reference elevations
 * --------------------
 *   - Airport-level (IHS, Conical, OHS): airport.elevation_m
 *   - Approach: the relevant threshold's elev_m
 *   - Take-off climb: the higher of the two runway thresholds (Annex 14 §4.1.29:
 *       "highest point on the extended runway centre line between the end of
 *        the runway and the take-off climb surface")
 *   - Transitional: linear interpolation of the two threshold elevations along
 *     the runway centerline
 */

import {
  alongTrackDistanceM,
  crossTrackDistanceM,
  destinationPoint,
  distanceToSegmentM,
  haversineDistanceM,
} from "./geo.ts";
import type { OLSConfig } from "./ols-config.ts";
import type {
  Airport,
  LatLon,
  Runway,
  RunwayThreshold,
  SurfaceHit,
} from "./types.ts";

// 1000 km is far enough to define a great-circle "ruler" without ambiguity.
const FAR_M = 1_000_000;

/**
 * Source of truth for runway orientation.
 *
 * Threshold lat/lon precision in AIP data is typically ±10 m. Over a 3 km
 * runway, that can compound to a ~5-15° error in the great-circle bearing
 * between the two thresholds vs. the published true bearing. The published
 * value is canonical for OLS purposes, so we always anchor on it.
 *
 * Convention:
 *   - `extensionBearingFor(runway, threshold)` returns the compass bearing
 *     in which the approach + take-off surfaces extend OUTWARD from that
 *     threshold (i.e. away from the runway, on the landing-approach side).
 */
function extensionBearingFor(
  runway: Runway,
  threshold: RunwayThreshold,
): number {
  // true_bearing is defined from threshold_a to threshold_b.
  // The approach side of threshold_a is opposite (true_bearing + 180);
  // the approach side of threshold_b is true_bearing itself.
  const isA = threshold === runway.threshold_a;
  return ((isA ? runway.true_bearing + 180 : runway.true_bearing) + 360) % 360;
}

/** Build a synthetic point along the runway centerline. */
function pointAlongCenterline(runway: Runway, fractionOfLength: number): LatLon {
  return destinationPoint(
    runway.threshold_a,
    runway.true_bearing,
    runway.length_m * fractionOfLength,
  );
}

// ---------------------------------------------------------------------------
// Airport-level surfaces
// ---------------------------------------------------------------------------

/** Inner Horizontal Surface: a horizontal plane at airport.elev + 45 m, inside
 *  a circle of `ihs_radius_m` around the ARP. */
export function evalInnerHorizontal(
  point: LatLon,
  airport: Airport,
  cfg: OLSConfig,
): SurfaceHit | null {
  const d = haversineDistanceM(point, airport.arp);
  if (d > cfg.ihs_radius_m) return null;
  return {
    surface: "inner_horizontal",
    airport_code: airport.code,
    max_top_amsl_m: airport.elevation_m + cfg.ihs_height_m,
    surface_height_above_origin_m: cfg.ihs_height_m,
    distance_to_origin_m: d,
  };
}

/** Conical Surface: rises at `conical_slope` from the edge of the IHS, capped
 *  at `conical_max_height_m` above airport elevation. Annular footprint. */
export function evalConical(
  point: LatLon,
  airport: Airport,
  cfg: OLSConfig,
): SurfaceHit | null {
  const d = haversineDistanceM(point, airport.arp);
  if (d <= cfg.ihs_radius_m) return null;
  const heightAboveAirport =
    cfg.ihs_height_m + cfg.conical_slope * (d - cfg.ihs_radius_m);
  if (heightAboveAirport > cfg.conical_max_height_m) return null;
  return {
    surface: "conical",
    airport_code: airport.code,
    max_top_amsl_m: airport.elevation_m + heightAboveAirport,
    surface_height_above_origin_m: heightAboveAirport,
    distance_to_origin_m: d,
  };
}

/** Outer Horizontal Surface: horizontal plane at airport.elev + 150 m, inside
 *  a circle of `ohs_radius_m` (15 km) around the ARP. */
export function evalOuterHorizontal(
  point: LatLon,
  airport: Airport,
  cfg: OLSConfig,
): SurfaceHit | null {
  const d = haversineDistanceM(point, airport.arp);
  if (d > cfg.ohs_radius_m) return null;
  return {
    surface: "outer_horizontal",
    airport_code: airport.code,
    max_top_amsl_m: airport.elevation_m + cfg.ohs_height_m,
    surface_height_above_origin_m: cfg.ohs_height_m,
    distance_to_origin_m: d,
  };
}

// ---------------------------------------------------------------------------
// Per-runway helpers
// ---------------------------------------------------------------------------

interface RunwayProjection {
  /** Signed distance from `threshold` along the extension bearing (positive =
   *  on the approach side of `threshold`, beyond the runway end). */
  along_from_threshold_m: number;
  /** Unsigned perpendicular distance from the extension axis. */
  cross_track_m: number;
}

/**
 * Project the query point into the local coordinate frame of one runway end.
 *
 * The "extension axis" extends from `threshold` outward along the published
 * `runway.true_bearing` (rotated 180° when projecting from threshold_a so the
 * axis points away from the runway in either case).
 *
 * - `along_from_threshold_m > 0` means the point is on the approach /
 *   take-off side of the threshold (correct side for those surfaces).
 * - `along_from_threshold_m < 0` means the point is over the runway or
 *   beyond the opposite end.
 */
function projectOntoExtension(
  point: LatLon,
  runway: Runway,
  threshold: RunwayThreshold,
): RunwayProjection {
  const extBearing = extensionBearingFor(runway, threshold);
  const far = destinationPoint(threshold, extBearing, FAR_M);
  return {
    along_from_threshold_m: alongTrackDistanceM(point, threshold, far),
    cross_track_m: Math.abs(crossTrackDistanceM(point, threshold, far)),
  };
}

/**
 * Height of the approach surface above its inner edge at along-track distance
 * `alongFromInnerEdgeM` from the inner edge. Returns null if outside.
 */
function approachHeightAt(cfg: OLSConfig, alongFromInnerEdgeM: number): number | null {
  if (alongFromInnerEdgeM < 0) return null;
  let h = 0;
  let remaining = alongFromInnerEdgeM;
  for (const section of cfg.approach.sections) {
    if (remaining <= 0) return h;
    const seg = Math.min(remaining, section.length_m);
    h += seg * section.slope;
    remaining -= section.length_m;
  }
  // Reached the end of the defined sections — outside the surface.
  return remaining > 0 ? null : h;
}

// ---------------------------------------------------------------------------
// Approach surface (per threshold)
// ---------------------------------------------------------------------------

/**
 * Approach Surface: a trapezoidal inclined plane extending from the inner edge
 * (60 m beyond the threshold, on the approach side) outward to 15 km, rising
 * at section-defined slopes and diverging at 15 % per side.
 *
 * @param threshold - The threshold being approached (e.g. "09" — landing aircraft
 *                    target this end).
 * @param oppositeThreshold - The other end of the runway, used to define the
 *                    runway's directional axis.
 */
export function evalApproach(
  point: LatLon,
  airport: Airport,
  runway: Runway,
  threshold: RunwayThreshold,
  _oppositeThreshold: RunwayThreshold,
  cfg: OLSConfig,
): SurfaceHit | null {
  const proj = projectOntoExtension(point, runway, threshold);
  const alongFromInnerEdge =
    proj.along_from_threshold_m - cfg.approach.distance_from_threshold_m;

  const totalLength = cfg.approach.sections.reduce((acc, s) => acc + s.length_m, 0);
  if (alongFromInnerEdge < 0 || alongFromInnerEdge > totalLength) return null;

  const halfWidth =
    cfg.approach.inner_edge_half_width_m +
    cfg.approach.divergence * alongFromInnerEdge;
  if (proj.cross_track_m > halfWidth) return null;

  const heightAboveThreshold = approachHeightAt(cfg, alongFromInnerEdge);
  if (heightAboveThreshold === null) return null;

  return {
    surface: "approach",
    airport_code: airport.code,
    runway_designator: runway.designator,
    threshold_name: threshold.name,
    max_top_amsl_m: threshold.elev_m + heightAboveThreshold,
    surface_height_above_origin_m: heightAboveThreshold,
    distance_to_origin_m: proj.along_from_threshold_m,
  };
}

// ---------------------------------------------------------------------------
// Take-off climb surface (per threshold)
// ---------------------------------------------------------------------------

/**
 * Take-off Climb Surface: a trapezoidal inclined plane extending from the inner
 * edge (60 m beyond the runway end, on the same side as the approach surface
 * for that threshold) outward to 15 km at a single 2 % slope, diverging at
 * 12.5 % per side.
 *
 * @param threshold - The threshold acting as the runway END for this departure
 *                    (aircraft departed from `oppositeThreshold` and are
 *                    climbing out past `threshold`).
 */
export function evalTakeoff(
  point: LatLon,
  airport: Airport,
  runway: Runway,
  threshold: RunwayThreshold,
  oppositeThreshold: RunwayThreshold,
  cfg: OLSConfig,
): SurfaceHit | null {
  const proj = projectOntoExtension(point, runway, threshold);
  const alongFromInnerEdge =
    proj.along_from_threshold_m - cfg.takeoff_climb.distance_from_runway_end_m;

  if (alongFromInnerEdge < 0 || alongFromInnerEdge > cfg.takeoff_climb.length_m) {
    return null;
  }

  const halfWidth =
    cfg.takeoff_climb.inner_edge_half_width_m +
    cfg.takeoff_climb.divergence * alongFromInnerEdge;
  if (proj.cross_track_m > halfWidth) return null;

  const heightAboveOrigin = cfg.takeoff_climb.slope * alongFromInnerEdge;
  // Annex 14 §4.1.29: origin elevation is the highest point along the runway
  // centerline between the take-off threshold and the runway end.
  const referenceElev = Math.max(threshold.elev_m, oppositeThreshold.elev_m);

  return {
    surface: "takeoff_climb",
    airport_code: airport.code,
    runway_designator: runway.designator,
    threshold_name: threshold.name,
    max_top_amsl_m: referenceElev + heightAboveOrigin,
    surface_height_above_origin_m: heightAboveOrigin,
    distance_to_origin_m: proj.along_from_threshold_m,
  };
}

// ---------------------------------------------------------------------------
// Transitional surface (per runway, alongside the strip)
// ---------------------------------------------------------------------------

/**
 * Transitional Surface: starts at the runway strip edge (≈ 150 m each side of
 * centerline for Code 4) and rises at 14.3 % laterally outward until it
 * intersects the Inner Horizontal Surface (at +45 m above airport elev).
 *
 * v1 simplification: we evaluate the alongside-strip portion only. The
 * alongside-approach-surface portion is a secondary effect for most MMR sites
 * (cross-track distances big enough to escape the IHS already encounter the
 * IHS / OHS as the binding constraint).
 */
export function evalTransitional(
  point: LatLon,
  airport: Airport,
  runway: Runway,
  cfg: OLSConfig,
): SurfaceHit | null {
  // Build a synthetic "true centerline" anchored at threshold_a and extending
  // along the published true_bearing for the runway length, so cross-track
  // and along-track are measured against the AIP-canonical axis rather than
  // the threshold-pair geodesic (which may diverge by 5-15° due to coordinate
  // imprecision in the seed data).
  const aEnd = runway.threshold_a;
  const bEnd = pointAlongCenterline(runway, 1);
  const distToSeg = distanceToSegmentM(point, aEnd, bEnd);
  if (distToSeg <= cfg.strip_half_width_m) return null; // inside the strip itself

  // Only the alongside-strip portion applies (between the two thresholds).
  const along = alongTrackDistanceM(point, aEnd, bEnd);
  if (along < 0 || along > runway.length_m) return null;

  const distFromStripEdge = distToSeg - cfg.strip_half_width_m;
  const heightAboveStrip = cfg.transitional_slope * distFromStripEdge;
  if (heightAboveStrip > cfg.ihs_height_m) return null; // surface has met the IHS

  // Strip elevation ≈ runway centerline at this along-track position
  const frac = along / runway.length_m;
  const stripElev =
    runway.threshold_a.elev_m +
    frac * (runway.threshold_b.elev_m - runway.threshold_a.elev_m);

  return {
    surface: "transitional",
    airport_code: airport.code,
    runway_designator: runway.designator,
    max_top_amsl_m: stripElev + heightAboveStrip,
    surface_height_above_origin_m: heightAboveStrip,
    distance_to_origin_m: distToSeg,
  };
}
