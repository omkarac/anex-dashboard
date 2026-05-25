import test from "node:test";
import assert from "node:assert/strict";

import { VABB } from "../airports.ts";
import {
  airportFootprints,
  approachFootprint,
  mmrFootprints,
  takeoffFootprint,
} from "../footprints.ts";
import { haversineDistanceM } from "../geo.ts";
import { CONFIG_CODE_4_PA } from "../ols-config.ts";

const APPROX = (a: number, b: number, tol: number, label = "") =>
  assert.ok(
    Math.abs(a - b) <= tol,
    `${label} expected ${a} ≈ ${b} (±${tol}), diff=${Math.abs(a - b).toFixed(2)}`,
  );

const RWY_09_27 = VABB.runways[0]!;
const TH_09 = RWY_09_27.threshold_a;
const CFG = CONFIG_CODE_4_PA;

// Trapezoid long-side helper: hypotenuse of (axis length × half-width
// change). For approach: sqrt(15000² + 2250²) ≈ 15169 m. For takeoff:
// sqrt(15000² + 1875²) ≈ 15117 m. Use centerline midpoints for axis length.
const midpoint = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => ({
  lat: (a.lat + b.lat) / 2,
  lon: (a.lon + b.lon) / 2,
});

test("approachFootprint — along-axis length is 15 km (Annex 14 Code 4)", () => {
  const poly = approachFootprint(RWY_09_27, TH_09, CFG);
  const innerMid = midpoint(poly[0]!, poly[3]!);
  const outerMid = midpoint(poly[1]!, poly[2]!);
  APPROX(haversineDistanceM(innerMid, outerMid), 15000, 60, "approach axis length");
});

test("approachFootprint — inner edge is 300 m wide for Code 4", () => {
  const poly = approachFootprint(RWY_09_27, TH_09, CFG);
  const innerLeft = poly[0]!;
  const innerRight = poly[3]!;
  const innerWidth = haversineDistanceM(innerLeft, innerRight);
  APPROX(innerWidth, 300, 5, "approach inner edge width");
});

test("approachFootprint — outer edge wider per 15 % divergence", () => {
  const poly = approachFootprint(RWY_09_27, TH_09, CFG);
  const outerLeft = poly[1]!;
  const outerRight = poly[2]!;
  const outerWidth = haversineDistanceM(outerLeft, outerRight);
  // 300 m inner + 2 × 0.15 × 15000 m divergence = 4800 m
  APPROX(outerWidth, 4800, 30, "approach outer edge width");
});

test("takeoffFootprint — along-axis 15 km, divergence 12.5 %", () => {
  const poly = takeoffFootprint(RWY_09_27, TH_09, CFG);
  const innerLeft = poly[0]!;
  const innerRight = poly[3]!;
  const outerLeft = poly[1]!;
  const outerRight = poly[2]!;

  const innerMid = midpoint(innerLeft, innerRight);
  const outerMid = midpoint(outerLeft, outerRight);
  APPROX(haversineDistanceM(innerMid, outerMid), 15000, 60, "takeoff axis length");
  // Inner edge: 180 m wide (= 2 × 90 m half-width).
  APPROX(haversineDistanceM(innerLeft, innerRight), 180, 5, "takeoff inner edge");
  // Outer edge: 180 + 2 × 0.125 × 15000 = 3930 m
  APPROX(haversineDistanceM(outerLeft, outerRight), 3930, 30, "takeoff outer edge");
});

test("airportFootprints — VABB yields 8 polygons (2 runways × 2 ends × 2 surfaces)", () => {
  const fps = airportFootprints(VABB);
  assert.equal(fps.length, 8);
  const approachCount = fps.filter((f) => f.surface === "approach").length;
  const takeoffCount = fps.filter((f) => f.surface === "takeoff_climb").length;
  assert.equal(approachCount, 4);
  assert.equal(takeoffCount, 4);
});

test("mmrFootprints — total polygon count across all MMR airports", () => {
  const fps = mmrFootprints();
  // VABB 8, VAJJ 8 (2 runways × 2 ends × 2 surfaces), VANM 4 (1 runway × 2 × 2)
  assert.equal(fps.length, 20);
});

test("Footprint vertices form a coherent trapezoid (inner narrow, outer wide)", () => {
  const poly = approachFootprint(RWY_09_27, TH_09, CFG);
  const [il, ol, or, ir] = poly;
  // inner edge: 300 m
  APPROX(haversineDistanceM(il, ir), 300, 5);
  // outer edge: 4800 m (300 + 2 × 0.15 × 15000)
  APPROX(haversineDistanceM(ol, or), 4800, 30);
  // long sides are the hypotenuse of axis-length × half-width-change, both
  // sides equal by symmetry: sqrt(15000² + 2250²) ≈ 15169 m.
  const expectedLongSide = Math.sqrt(15000 * 15000 + 2250 * 2250);
  APPROX(haversineDistanceM(il, ol), expectedLongSide, 60, "left long side");
  APPROX(haversineDistanceM(ir, or), expectedLongSide, 60, "right long side");
});
