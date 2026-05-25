import test from "node:test";
import assert from "node:assert/strict";

import { VABB } from "../airports.ts";
import { destinationPoint } from "../geo.ts";
import { CONFIG_CODE_4_PA, configForRunway } from "../ols-config.ts";
import {
  evalApproach,
  evalConical,
  evalInnerHorizontal,
  evalOuterHorizontal,
  evalTakeoff,
  evalTransitional,
} from "../surfaces.ts";

const APPROX = (a: number, b: number, tol: number, label = "") =>
  assert.ok(
    Math.abs(a - b) <= tol,
    `${label} expected ${a} ≈ ${b} (±${tol}), diff=${Math.abs(a - b).toFixed(2)}`,
  );

const CFG = CONFIG_CODE_4_PA;
const RWY_09_27 = VABB.runways[0]!;
const RWY_14_32 = VABB.runways[1]!;
const TH_09 = RWY_09_27.threshold_a;
const TH_27 = RWY_09_27.threshold_b;
const RWY_CFG = configForRunway(RWY_09_27.code, RWY_09_27.precision_approach);

// ---------------------------------------------------------------------------
// Inner Horizontal
// ---------------------------------------------------------------------------

test("IHS — at the ARP, limit = airport elev + 45 m", () => {
  const hit = evalInnerHorizontal(VABB.arp, VABB, CFG);
  assert.ok(hit);
  APPROX(hit.max_top_amsl_m, VABB.elevation_m + 45, 0.01, "IHS top");
});

test("IHS — just inside the 4 km boundary still triggers", () => {
  const p = destinationPoint(VABB.arp, 0, 3950);
  const hit = evalInnerHorizontal(p, VABB, CFG);
  assert.ok(hit);
  APPROX(hit.max_top_amsl_m, VABB.elevation_m + 45, 0.01);
});

test("IHS — just outside the 4 km boundary returns null", () => {
  const p = destinationPoint(VABB.arp, 0, 4050);
  assert.equal(evalInnerHorizontal(p, VABB, CFG), null);
});

// ---------------------------------------------------------------------------
// Conical
// ---------------------------------------------------------------------------

test("Conical — at IHS edge (4 km from ARP) = 45 m above airport (transition)", () => {
  const p = destinationPoint(VABB.arp, 0, 4000.01);
  const hit = evalConical(p, VABB, CFG);
  assert.ok(hit);
  APPROX(hit.max_top_amsl_m, VABB.elevation_m + 45, 0.05, "Conical at IHS edge");
});

test("Conical — at 5 km from ARP (1 km beyond IHS) = 45 + 50 = 95 m above airport", () => {
  const p = destinationPoint(VABB.arp, 0, 5000);
  const hit = evalConical(p, VABB, CFG);
  assert.ok(hit);
  APPROX(hit.max_top_amsl_m, VABB.elevation_m + 95, 0.5, "Conical at 5 km");
});

test("Conical — at outer edge (6 km from ARP) = 45 + 100 = 145 m above airport (cap)", () => {
  const p = destinationPoint(VABB.arp, 0, 5995);
  const hit = evalConical(p, VABB, CFG);
  assert.ok(hit);
  APPROX(hit.max_top_amsl_m, VABB.elevation_m + 145, 0.5, "Conical at outer edge");
});

test("Conical — beyond outer edge (6.5 km from ARP) returns null", () => {
  const p = destinationPoint(VABB.arp, 0, 6500);
  assert.equal(evalConical(p, VABB, CFG), null);
});

test("Conical — inside IHS (does not apply) returns null", () => {
  const p = destinationPoint(VABB.arp, 0, 2000);
  assert.equal(evalConical(p, VABB, CFG), null);
});

// ---------------------------------------------------------------------------
// Outer Horizontal
// ---------------------------------------------------------------------------

test("OHS — at the ARP, limit = airport elev + 150 m", () => {
  const hit = evalOuterHorizontal(VABB.arp, VABB, CFG);
  assert.ok(hit);
  APPROX(hit.max_top_amsl_m, VABB.elevation_m + 150, 0.01);
});

test("OHS — at 14 km from ARP, still applies", () => {
  const p = destinationPoint(VABB.arp, 0, 14000);
  const hit = evalOuterHorizontal(p, VABB, CFG);
  assert.ok(hit);
  APPROX(hit.max_top_amsl_m, VABB.elevation_m + 150, 0.01);
});

test("OHS — at 16 km from ARP, outside footprint", () => {
  const p = destinationPoint(VABB.arp, 0, 16000);
  assert.equal(evalOuterHorizontal(p, VABB, CFG), null);
});

// ---------------------------------------------------------------------------
// Approach surface
// ---------------------------------------------------------------------------

test("Approach to threshold 09 — 1 km out along centerline = threshold + 0.02 × 940 = +18.8 m", () => {
  // Build a point 1 km west of threshold 09 along extension axis.
  // Direction: from threshold 27 toward threshold 09, extended past 09.
  const extBearing = (RWY_09_27.true_bearing + 180) % 360; // bearing from 27 toward 09
  const p = destinationPoint(TH_09, extBearing, 1000);
  const hit = evalApproach(p, VABB, RWY_09_27, TH_09, TH_27, RWY_CFG);
  assert.ok(hit, "expected to be inside the approach surface");
  // Distance from inner edge = 1000 - 60 = 940 m → height = 940 × 0.02 = 18.8 m
  APPROX(hit.surface_height_above_origin_m, 18.8, 0.1, "approach height @ 1 km");
  APPROX(hit.max_top_amsl_m, TH_09.elev_m + 18.8, 0.1);
});

test("Approach to 09 — at exactly the inner edge (60 m past threshold) = threshold elev", () => {
  const extBearing = (RWY_09_27.true_bearing + 180) % 360;
  const p = destinationPoint(TH_09, extBearing, 60);
  const hit = evalApproach(p, VABB, RWY_09_27, TH_09, TH_27, RWY_CFG);
  assert.ok(hit);
  APPROX(hit.surface_height_above_origin_m, 0, 0.1);
});

test("Approach to 09 — 4 km out: section 1 (3 km × 2%) + 1 km × 2.5% = 60 + 25 = 85 m", () => {
  const extBearing = (RWY_09_27.true_bearing + 180) % 360;
  const p = destinationPoint(TH_09, extBearing, 4060); // 4000 m past inner edge
  const hit = evalApproach(p, VABB, RWY_09_27, TH_09, TH_27, RWY_CFG);
  assert.ok(hit);
  APPROX(hit.surface_height_above_origin_m, 85, 0.5, "approach @ 4 km");
});

test("Approach to 09 — 10 km out: 60 + 90 + 0 = 150 m (horizontal section)", () => {
  const extBearing = (RWY_09_27.true_bearing + 180) % 360;
  const p = destinationPoint(TH_09, extBearing, 10060);
  const hit = evalApproach(p, VABB, RWY_09_27, TH_09, TH_27, RWY_CFG);
  assert.ok(hit);
  APPROX(hit.surface_height_above_origin_m, 150, 0.5, "approach @ 10 km");
});

test("Approach to 09 — beyond 15 km total length returns null", () => {
  const extBearing = (RWY_09_27.true_bearing + 180) % 360;
  const p = destinationPoint(TH_09, extBearing, 15200);
  assert.equal(evalApproach(p, VABB, RWY_09_27, TH_09, TH_27, RWY_CFG), null);
});

test("Approach to 09 — lateral offset beyond half-width returns null", () => {
  const extBearing = (RWY_09_27.true_bearing + 180) % 360;
  // At 3 km past inner edge, half-width = 150 + 0.15 × 3000 = 600 m. Try 700 m offset.
  const along = destinationPoint(TH_09, extBearing, 3060);
  const offset = destinationPoint(along, (extBearing + 90) % 360, 700);
  assert.equal(evalApproach(offset, VABB, RWY_09_27, TH_09, TH_27, RWY_CFG), null);
});

test("Approach to 09 — on the wrong side of threshold (over the runway) returns null", () => {
  // Project 1 km AWAY from threshold 09 toward 27 (on the runway side, not approach side)
  const p = destinationPoint(TH_09, RWY_09_27.true_bearing, 1000);
  assert.equal(evalApproach(p, VABB, RWY_09_27, TH_09, TH_27, RWY_CFG), null);
});

// ---------------------------------------------------------------------------
// Take-off climb surface
// ---------------------------------------------------------------------------

test("Take-off past 09 — 1 km out along centerline = +18.8 m above ref elev", () => {
  const extBearing = (RWY_09_27.true_bearing + 180) % 360;
  const p = destinationPoint(TH_09, extBearing, 1000);
  const hit = evalTakeoff(p, VABB, RWY_09_27, TH_09, TH_27, RWY_CFG);
  assert.ok(hit);
  // 1000 m - 60 m = 940 m past inner edge; height = 940 × 0.02 = 18.8 m
  APPROX(hit.surface_height_above_origin_m, 18.8, 0.1);
});

test("Take-off past 09 — wider divergence than approach (12.5 % vs 15 %)", () => {
  // At 3 km past inner edge, takeoff half-width = 90 + 0.125 × 3000 = 465 m
  const extBearing = (RWY_09_27.true_bearing + 180) % 360;
  const along = destinationPoint(TH_09, extBearing, 3060);
  const within = destinationPoint(along, (extBearing + 90) % 360, 400);
  const beyond = destinationPoint(along, (extBearing + 90) % 360, 500);
  assert.ok(evalTakeoff(within, VABB, RWY_09_27, TH_09, TH_27, RWY_CFG));
  assert.equal(evalTakeoff(beyond, VABB, RWY_09_27, TH_09, TH_27, RWY_CFG), null);
});

// ---------------------------------------------------------------------------
// Transitional surface
// ---------------------------------------------------------------------------

test("Transitional — 200 m offset from RWY 09/27 centerline (50 m beyond strip edge) = 50 × 14.3% = 7.15 m above strip", () => {
  // Find a point alongside the runway at 200 m perpendicular offset.
  // Use the runway's true bearing (92.1°) and offset perpendicular (182.1°).
  const midpoint = destinationPoint(TH_09, RWY_09_27.true_bearing, RWY_09_27.length_m / 2);
  const perp = (RWY_09_27.true_bearing + 90) % 360;
  const p = destinationPoint(midpoint, perp, 200);
  const hit = evalTransitional(p, VABB, RWY_09_27, RWY_CFG);
  assert.ok(hit, "expected transitional surface to apply at 200 m offset");
  // 200 m - 150 m (strip half-width) = 50 m; height = 50 / 7 ≈ 7.14 m
  APPROX(hit.surface_height_above_origin_m, 50 / 7, 0.1);
});

test("Transitional — offset within strip (under 150 m) returns null", () => {
  const midpoint = destinationPoint(TH_09, RWY_09_27.true_bearing, RWY_09_27.length_m / 2);
  const perp = (RWY_09_27.true_bearing + 90) % 360;
  const p = destinationPoint(midpoint, perp, 100);
  assert.equal(evalTransitional(p, VABB, RWY_09_27, RWY_CFG), null);
});

test("Transitional — offset beyond where surface meets IHS returns null", () => {
  // Transitional meets IHS at offset 150 + 45 × 7 = 150 + 315 = 465 m. At 500 m it has met IHS.
  const midpoint = destinationPoint(TH_09, RWY_09_27.true_bearing, RWY_09_27.length_m / 2);
  const perp = (RWY_09_27.true_bearing + 90) % 360;
  const p = destinationPoint(midpoint, perp, 500);
  assert.equal(evalTransitional(p, VABB, RWY_09_27, RWY_CFG), null);
});

test("Transitional — projected beyond runway ends returns null", () => {
  // 200 m offset, projected 500 m past threshold 09 (away from 27)
  const beyond09 = destinationPoint(TH_09, (RWY_09_27.true_bearing + 180) % 360, 500);
  const perp = (RWY_09_27.true_bearing + 90) % 360;
  const p = destinationPoint(beyond09, perp, 200);
  assert.equal(evalTransitional(p, VABB, RWY_09_27, RWY_CFG), null);
});

// Sanity: ensure RWY 14/32 yields independent surfaces (no test, just type-level)
test("Sanity — RWY 14/32 transitional fires at perpendicular offset to its centerline", () => {
  const mid = destinationPoint(
    RWY_14_32.threshold_a,
    RWY_14_32.true_bearing,
    RWY_14_32.length_m / 2,
  );
  const perp = (RWY_14_32.true_bearing + 90) % 360;
  const p = destinationPoint(mid, perp, 200);
  const hit = evalTransitional(p, VABB, RWY_14_32, RWY_CFG);
  assert.ok(hit);
});
