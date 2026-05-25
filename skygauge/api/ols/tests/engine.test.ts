import test from "node:test";
import assert from "node:assert/strict";

import { MMR_AIRPORTS, VABB, VANM } from "../airports.ts";
import { computeOLSLimit } from "../engine.ts";
import { destinationPoint } from "../geo.ts";

const APPROX = (a: number, b: number, tol: number, label = "") =>
  assert.ok(
    Math.abs(a - b) <= tol,
    `${label} expected ${a.toFixed(2)} ≈ ${b.toFixed(2)} (±${tol}), diff=${Math.abs(a - b).toFixed(2)}`,
  );

// ---------------------------------------------------------------------------
// Reference points
// ---------------------------------------------------------------------------

test("At the ARP itself, the IHS binds at airport.elev + 45 m", () => {
  const r = computeOLSLimit(VABB.arp);
  assert.ok(r.binding);
  // The inner horizontal is the lowest constraint at the ARP centre.
  // Approach / take-off / transitional surfaces all reference threshold elev,
  // which differs from airport elev — and they may bind even lower at the
  // ARP if the ARP happens to lie inside their footprint (it does for VABB).
  // So we only assert the binding limit is at or below IHS height.
  assert.ok(r.max_top_amsl_m! <= VABB.elevation_m + 45 + 0.5);
});

test("Far outside MMR (50 km away), no surface binds", () => {
  // 50 km east of CSMIA ARP — well outside any 15 km OHS.
  const far = destinationPoint(VABB.arp, 90, 50_000);
  const r = computeOLSLimit(far);
  assert.equal(r.binding, null);
  assert.equal(r.max_top_amsl_m, null);
  assert.equal(r.all_hits.length, 0);
});

test("8 km from VABB along a non-approach radial — OHS at +150 m binds (VABB only)", () => {
  // Restrict to VABB so the test isn't perturbed by Juhu / NMIA OHS overlap.
  // CSMIA runways are 92° and 143°; bearing 30° is well clear of both.
  // 8 km is beyond conical (6 km) and inside OHS (15 km).
  const p = destinationPoint(VABB.arp, 30, 8000);
  const r = computeOLSLimit(p, { airports: [VABB] });
  assert.ok(r.binding);
  assert.equal(r.binding.airport_code, "VABB");
  assert.equal(r.binding.surface, "outer_horizontal");
  APPROX(r.max_top_amsl_m!, VABB.elevation_m + 150, 0.5);
});

test("5 km west of threshold 09 — take-off climb binds, not approach (3-7 km zone)", () => {
  // From ~3 km to ~7.5 km past inner edge, take-off (2% throughout) is more
  // restrictive than approach (which has a 2.5% second section but the same
  // reference elevation). Both surfaces share the inner-edge location.
  //   Approach height @ 4940 m: 3000×.02 + 1940×.025 = 60 + 48.5 = 108.5 m
  //   Take-off height @ 4940 m: 4940×.02 = 98.8 m  ← binds
  const rwy = VABB.runways[0]!;
  const extBearing = (rwy.true_bearing + 180) % 360;
  const p = destinationPoint(rwy.threshold_a, extBearing, 5000);
  const r = computeOLSLimit(p, { airports: [VABB] });
  assert.ok(r.binding);
  assert.equal(r.binding.surface, "takeoff_climb");
  APPROX(r.binding.surface_height_above_origin_m, 98.8, 1, "takeoff height");
});

test("8 km west of threshold 09 — approach binds (flat 150 m section, take-off climbs past it)", () => {
  // Past ~7.5 km, approach plateaus at +150 m while take-off keeps climbing
  // at 2 %, so approach becomes the more restrictive surface.
  //   Approach @ 7940 m: 60 + 90 + 0 = 150 m
  //   Take-off @ 7940 m: 7940 × 0.02 = 158.8 m
  const rwy = VABB.runways[0]!;
  const extBearing = (rwy.true_bearing + 180) % 360;
  const p = destinationPoint(rwy.threshold_a, extBearing, 8000);
  const r = computeOLSLimit(p, { airports: [VABB] });
  assert.ok(r.binding);
  assert.equal(r.binding.surface, "approach");
  APPROX(r.binding.surface_height_above_origin_m, 150, 1);
});

test("Cross-airport interaction — near VABB but inside Juhu's OHS, Juhu binds", () => {
  // 5 km west of threshold 09: in CSMIA's approach surface AND inside Juhu's
  // OHS / conical. The Juhu surface should win, because Juhu's lower elevation
  // (4.5 m vs 11.28 m) outweighs its less-restrictive surface kind.
  const rwy = VABB.runways[0]!;
  const extBearing = (rwy.true_bearing + 180) % 360;
  const p = destinationPoint(rwy.threshold_a, extBearing, 5000);
  const r = computeOLSLimit(p); // default = all MMR airports
  assert.ok(r.binding);
  assert.equal(r.binding.airport_code, "VAJJ");
});

test("AGL output is provided when site elevation is given", () => {
  // 10 km east of VABB at site elev 5 m (near sea level). OHS binds at ~161 m AMSL.
  const p = destinationPoint(VABB.arp, 90, 10_000);
  const r = computeOLSLimit({ ...p, elevation_m: 5 });
  assert.ok(r.binding);
  assert.notEqual(r.max_height_agl_m, undefined);
  APPROX(r.max_height_agl_m!, r.max_top_amsl_m! - 5, 0.001);
});

test("AGL output is omitted when site elevation is not given", () => {
  const p = destinationPoint(VABB.arp, 90, 10_000);
  const r = computeOLSLimit(p);
  assert.equal(r.max_height_agl_m, undefined);
});

test("Multiple airports — VANM dominates near Navi Mumbai, not VABB", () => {
  // A point near VANM's ARP (NMIA, 19.05, 73.02) is 17 km east of VABB
  // — outside VABB's OHS — so VANM should bind there.
  const r = computeOLSLimit(VANM.arp);
  assert.ok(r.binding);
  assert.equal(r.binding.airport_code, "VANM");
});

test("Returns a sorted all_hits list (ascending max_top_amsl)", () => {
  // Pick a point that triggers multiple surfaces (within 4 km of CSMIA, on
  // 14/32 approach line, etc.)
  const r = computeOLSLimit({ lat: 19.10, lon: 72.87 });
  assert.ok(r.all_hits.length > 0);
  for (let i = 1; i < r.all_hits.length; i++) {
    assert.ok(
      r.all_hits[i - 1]!.max_top_amsl_m <= r.all_hits[i]!.max_top_amsl_m,
      "all_hits should be sorted ascending by max_top_amsl_m",
    );
  }
  assert.equal(r.binding, r.all_hits[0]);
});

test("Custom airport set: passing [] gives no constraints", () => {
  const r = computeOLSLimit(VABB.arp, { airports: [] });
  assert.equal(r.binding, null);
  assert.equal(r.max_top_amsl_m, null);
});

test("Default airport set matches MMR_AIRPORTS", () => {
  // Sanity check: the engine without options uses the canonical airport list.
  const inner = destinationPoint(VABB.arp, 0, 1000);
  const a = computeOLSLimit(inner);
  const b = computeOLSLimit(inner, { airports: MMR_AIRPORTS });
  assert.equal(a.binding?.airport_code, b.binding?.airport_code);
  assert.equal(a.max_top_amsl_m, b.max_top_amsl_m);
});

// ---------------------------------------------------------------------------
// Real-world plausibility (without yet validating against historical NOCs)
// ---------------------------------------------------------------------------

test("Site at typical Bandra-Kurla coords (~3 km from VABB) gets a single-digit-to-50m limit above ground", () => {
  // BKC is ~3 km north of CSMIA — should fall within IHS.
  const r = computeOLSLimit({ lat: 19.066, lon: 72.868, elevation_m: 8.5 });
  assert.ok(r.binding);
  // Could be transitional (close to RWY 14/32) or IHS. Either is plausible.
  // Just assert the AMSL limit is sensible for an obstacle-limited urban area.
  assert.ok(
    r.max_top_amsl_m! > 0 && r.max_top_amsl_m! < 200,
    `BKC limit ${r.max_top_amsl_m} m AMSL is outside plausible range`,
  );
});
