/**
 * OLS surface footprint geometry.
 *
 * Pure functions that return the polygon outline (as LatLon vertices) of each
 * per-runway OLS surface — so the map UI can draw them without re-implementing
 * the geometry that already lives in surfaces.ts.
 *
 * All polygons are returned in clockwise vertex order, starting at the
 * inner-edge left corner (left as seen from the inner edge looking outward
 * along the surface axis).
 *
 * The exported `mmrFootprints()` helper returns every per-runway footprint
 * across all configured MMR airports, classified by surface kind — ready to
 * feed directly into Leaflet `Polygon` components.
 */

import { MMR_AIRPORTS } from "./airports.ts";
import { destinationPoint } from "./geo.ts";
import { configForRunway, type OLSConfig } from "./ols-config.ts";
import type {
  Airport,
  LatLon,
  Runway,
  RunwayThreshold,
  SurfaceKind,
} from "./types.ts";

/** A 4-vertex polygon outline in CW order from the inner-edge left corner. */
export type Footprint4 = readonly [LatLon, LatLon, LatLon, LatLon];

/** A footprint annotated with the surface + runway it represents. */
export interface AnnotatedFootprint {
  readonly airport_code: string;
  readonly runway_designator: string;
  readonly threshold_name: string;
  readonly surface: Extract<SurfaceKind, "approach" | "takeoff_climb">;
  readonly polygon: Footprint4;
  /** Length of the surface from the inner edge to the outer edge, metres. */
  readonly length_m: number;
}

/** Direction from a threshold outward along the approach / take-off axis. */
function extensionBearing(runway: Runway, threshold: RunwayThreshold): number {
  const isA = threshold === runway.threshold_a;
  return ((isA ? runway.true_bearing + 180 : runway.true_bearing) + 360) % 360;
}

/**
 * Build a trapezoidal footprint from a threshold outward along the extension
 * axis. Used for both approach and take-off climb surfaces — they share the
 * same trapezoidal shape, differing only in `inner_half_width`, `divergence`,
 * `offset` (distance from threshold to inner edge), and `length`.
 */
function buildTrapezoid(
  threshold: RunwayThreshold,
  bearing: number,
  innerOffsetM: number,
  innerHalfWidthM: number,
  divergence: number,
  lengthM: number,
): Footprint4 {
  const innerCenter = destinationPoint(threshold, bearing, innerOffsetM);
  const outerCenter = destinationPoint(threshold, bearing, innerOffsetM + lengthM);
  const outerHalfWidthM = innerHalfWidthM + divergence * lengthM;

  const leftBearing = (bearing - 90 + 360) % 360;
  const rightBearing = (bearing + 90) % 360;

  // CW from inner-edge LEFT corner: inner-left → outer-left → outer-right → inner-right
  const innerLeft = destinationPoint(innerCenter, leftBearing, innerHalfWidthM);
  const outerLeft = destinationPoint(outerCenter, leftBearing, outerHalfWidthM);
  const outerRight = destinationPoint(outerCenter, rightBearing, outerHalfWidthM);
  const innerRight = destinationPoint(innerCenter, rightBearing, innerHalfWidthM);

  return [innerLeft, outerLeft, outerRight, innerRight];
}

/** Approach surface footprint for one threshold. */
export function approachFootprint(
  runway: Runway,
  threshold: RunwayThreshold,
  cfg: OLSConfig,
): Footprint4 {
  const totalLength = cfg.approach.sections.reduce((s, sec) => s + sec.length_m, 0);
  return buildTrapezoid(
    threshold,
    extensionBearing(runway, threshold),
    cfg.approach.distance_from_threshold_m,
    cfg.approach.inner_edge_half_width_m,
    cfg.approach.divergence,
    totalLength,
  );
}

/** Take-off climb surface footprint for departures past one threshold. */
export function takeoffFootprint(
  runway: Runway,
  threshold: RunwayThreshold,
  cfg: OLSConfig,
): Footprint4 {
  return buildTrapezoid(
    threshold,
    extensionBearing(runway, threshold),
    cfg.takeoff_climb.distance_from_runway_end_m,
    cfg.takeoff_climb.inner_edge_half_width_m,
    cfg.takeoff_climb.divergence,
    cfg.takeoff_climb.length_m,
  );
}

/** Every per-runway approach + take-off footprint across the airport set. */
export function airportFootprints(airport: Airport): AnnotatedFootprint[] {
  const out: AnnotatedFootprint[] = [];
  for (const runway of airport.runways) {
    const cfg = configForRunway(runway.code, runway.precision_approach);
    const totalApproachLength = cfg.approach.sections.reduce(
      (s, sec) => s + sec.length_m,
      0,
    );
    for (const threshold of [runway.threshold_a, runway.threshold_b]) {
      out.push({
        airport_code: airport.code,
        runway_designator: runway.designator,
        threshold_name: threshold.name,
        surface: "approach",
        polygon: approachFootprint(runway, threshold, cfg),
        length_m: totalApproachLength,
      });
      out.push({
        airport_code: airport.code,
        runway_designator: runway.designator,
        threshold_name: threshold.name,
        surface: "takeoff_climb",
        polygon: takeoffFootprint(runway, threshold, cfg),
        length_m: cfg.takeoff_climb.length_m,
      });
    }
  }
  return out;
}

/** All per-runway footprints across every MMR airport. */
export function mmrFootprints(): AnnotatedFootprint[] {
  return MMR_AIRPORTS.flatMap(airportFootprints);
}
