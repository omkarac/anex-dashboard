/**
 * Skygauge OLS engine — orchestrator.
 *
 * Given a query point (and optionally its ground elevation), evaluates every
 * applicable ICAO Annex 14 surface across every MMR airport runway and returns
 * the binding (most restrictive) constraint plus the full set of hits.
 *
 * Usage:
 *
 *     import { computeOLSLimit, MMR_AIRPORTS } from "./ols";
 *
 *     const result = computeOLSLimit({ lat: 19.09, lon: 72.87, elevation_m: 7.2 });
 *     if (result.binding) {
 *       console.log(
 *         `Max top: ${result.max_top_amsl_m.toFixed(1)} m AMSL ` +
 *         `(binding: ${result.binding.surface} at ${result.binding.airport_code})`
 *       );
 *     }
 */

import { MMR_AIRPORTS } from "./airports.ts";
import { airportConfig, configForRunway } from "./ols-config.ts";
import {
  evalApproach,
  evalConical,
  evalInnerHorizontal,
  evalOuterHorizontal,
  evalTakeoff,
  evalTransitional,
} from "./surfaces.ts";
import type { Airport, OLSResult, SitePoint, SurfaceHit } from "./types.ts";

export interface ComputeOptions {
  /** Override the airport set (e.g. for testing). Defaults to MMR_AIRPORTS. */
  readonly airports?: readonly Airport[];
}

/**
 * Evaluate the OLS constraints at a query point.
 *
 * Algorithm: for each airport, evaluate the three airport-wide surfaces (IHS,
 * Conical, OHS) using the airport's most restrictive runway config. Then for
 * each runway evaluate the per-runway surfaces (approach × 2 thresholds,
 * take-off × 2 thresholds, transitional × 1) using that runway's own code.
 * Collect every non-null hit, sort by `max_top_amsl_m`, return the lowest as
 * the binding constraint.
 */
export function computeOLSLimit(
  site: SitePoint,
  options: ComputeOptions = {},
): OLSResult {
  const airports = options.airports ?? MMR_AIRPORTS;
  const hits: SurfaceHit[] = [];

  for (const airport of airports) {
    // Airport-level surfaces use the most restrictive runway's config.
    const apCfg = airportConfig(airport.runways);

    pushIfHit(hits, evalInnerHorizontal(site, airport, apCfg));
    pushIfHit(hits, evalConical(site, airport, apCfg));
    pushIfHit(hits, evalOuterHorizontal(site, airport, apCfg));

    for (const runway of airport.runways) {
      const rwCfg = configForRunway(runway.code, runway.precision_approach);

      // Approach + take-off: each runway has two ends, each contributing both.
      pushIfHit(hits,
        evalApproach(site, airport, runway, runway.threshold_a, runway.threshold_b, rwCfg));
      pushIfHit(hits,
        evalApproach(site, airport, runway, runway.threshold_b, runway.threshold_a, rwCfg));
      pushIfHit(hits,
        evalTakeoff(site, airport, runway, runway.threshold_a, runway.threshold_b, rwCfg));
      pushIfHit(hits,
        evalTakeoff(site, airport, runway, runway.threshold_b, runway.threshold_a, rwCfg));

      // Transitional: one per runway (alongside the strip).
      pushIfHit(hits, evalTransitional(site, airport, runway, rwCfg));
    }
  }

  // Sort by binding-ness: lowest max_top wins.
  hits.sort((a, b) => a.max_top_amsl_m - b.max_top_amsl_m);

  const binding = hits[0] ?? null;
  const max_top_amsl_m = binding?.max_top_amsl_m ?? null;
  const max_height_agl_m =
    binding && site.elevation_m !== undefined
      ? binding.max_top_amsl_m - site.elevation_m
      : undefined;

  return {
    binding,
    max_top_amsl_m,
    max_height_agl_m,
    all_hits: hits,
  };
}

function pushIfHit(hits: SurfaceHit[], hit: SurfaceHit | null): void {
  if (hit !== null) hits.push(hit);
}
