import test from "node:test";
import assert from "node:assert/strict";

import {
  alongTrackDistanceM,
  crossTrackDistanceM,
  destinationPoint,
  distanceToSegmentM,
  haversineDistanceM,
  initialBearingDeg,
} from "../geo.ts";

const APPROX_M = (a: number, b: number, tolM: number) =>
  assert.ok(Math.abs(a - b) <= tolM, `expected ${a} ≈ ${b} (±${tolM} m), diff=${Math.abs(a - b)}`);
const APPROX_DEG = (a: number, b: number, tolDeg: number) =>
  assert.ok(Math.abs(a - b) <= tolDeg, `expected ${a}° ≈ ${b}° (±${tolDeg}°), diff=${Math.abs(a - b)}`);

const CSMIA_ARP = { lat: 19.0916944, lon: 72.8654722 };
const JUHU_ARP = { lat: 19.0967, lon: 72.8347 };

test("haversineDistanceM — CSMIA to Juhu (~3.3 km, validated against geodesy.js)", () => {
  const d = haversineDistanceM(CSMIA_ARP, JUHU_ARP);
  APPROX_M(d, 3260, 30); // empirical reference 3.26 km, ±30 m tolerance for spherical vs WGS-84
});

test("haversineDistanceM — symmetric", () => {
  assert.equal(
    haversineDistanceM(CSMIA_ARP, JUHU_ARP),
    haversineDistanceM(JUHU_ARP, CSMIA_ARP),
  );
});

test("haversineDistanceM — same point = 0", () => {
  assert.equal(haversineDistanceM(CSMIA_ARP, CSMIA_ARP), 0);
});

test("initialBearingDeg — Juhu is WNW of CSMIA (~280°)", () => {
  // CSMIA ARP (19.0917, 72.8655) → Juhu ARP (19.0967, 72.8347).
  // Δlat ≈ +0.005° (NORTH ~555 m), Δlon ≈ −0.031° (WEST ~3225 m).
  // True initial bearing ≈ 279.8° (just north of due west).
  const b = initialBearingDeg(CSMIA_ARP, JUHU_ARP);
  APPROX_DEG(b, 280, 1);
});

test("initialBearingDeg — due north of origin gives 0°", () => {
  const origin = { lat: 19.0, lon: 72.0 };
  const north = { lat: 20.0, lon: 72.0 };
  APPROX_DEG(initialBearingDeg(origin, north), 0, 0.01);
});

test("initialBearingDeg — due east gives ~90°", () => {
  const origin = { lat: 0, lon: 0 };
  const east = { lat: 0, lon: 1 };
  APPROX_DEG(initialBearingDeg(origin, east), 90, 0.01);
});

test("destinationPoint — round-trip with haversine", () => {
  const start = CSMIA_ARP;
  const bearing = 90;
  const dist = 5000;
  const dest = destinationPoint(start, bearing, dist);
  APPROX_M(haversineDistanceM(start, dest), dist, 1);
});

test("destinationPoint — 1000 m east stays at same lat", () => {
  const start = { lat: 19.0, lon: 72.0 };
  const east = destinationPoint(start, 90, 1000);
  APPROX_M(east.lat * 111320, start.lat * 111320, 5); // lat change should be ~0
});

test("crossTrackDistanceM — point on the line itself = 0", () => {
  const a = { lat: 19.0, lon: 72.0 };
  const b = { lat: 19.1, lon: 72.1 };
  const mid = destinationPoint(a, initialBearingDeg(a, b), haversineDistanceM(a, b) / 2);
  APPROX_M(crossTrackDistanceM(mid, a, b), 0, 1);
});

test("crossTrackDistanceM — sign convention (right of A→B is positive)", () => {
  // A→B heading north; a point slightly east is to the RIGHT → positive
  const a = { lat: 19.0, lon: 72.0 };
  const b = { lat: 19.1, lon: 72.0 };
  const east = { lat: 19.05, lon: 72.001 };
  assert.ok(crossTrackDistanceM(east, a, b) > 0);
  // a point slightly west is to the LEFT → negative
  const west = { lat: 19.05, lon: 71.999 };
  assert.ok(crossTrackDistanceM(west, a, b) < 0);
});

test("alongTrackDistanceM — at lineStart = 0", () => {
  const a = { lat: 19.0, lon: 72.0 };
  const b = { lat: 19.1, lon: 72.0 };
  APPROX_M(alongTrackDistanceM(a, a, b), 0, 1);
});

test("alongTrackDistanceM — at lineEnd ≈ segment length", () => {
  const a = { lat: 19.0, lon: 72.0 };
  const b = { lat: 19.05, lon: 72.0 };
  const segLen = haversineDistanceM(a, b);
  APPROX_M(alongTrackDistanceM(b, a, b), segLen, 1);
});

test("alongTrackDistanceM — point behind lineStart is negative", () => {
  const a = { lat: 19.0, lon: 72.0 };
  const b = { lat: 19.1, lon: 72.0 };
  const behind = { lat: 18.99, lon: 72.0 };
  assert.ok(alongTrackDistanceM(behind, a, b) < 0);
});

test("distanceToSegmentM — perpendicular from midpoint", () => {
  // Line is north-south; point 100 m east of midpoint should give ~100 m
  const a = { lat: 19.0, lon: 72.0 };
  const b = { lat: 19.01, lon: 72.0 };
  const midpoint = destinationPoint(a, 0, haversineDistanceM(a, b) / 2);
  const offset = destinationPoint(midpoint, 90, 100);
  APPROX_M(distanceToSegmentM(offset, a, b), 100, 1);
});

test("distanceToSegmentM — clip to endpoint when projection is beyond segment", () => {
  const a = { lat: 19.0, lon: 72.0 };
  const b = { lat: 19.001, lon: 72.0 };
  const beyondB = { lat: 19.01, lon: 72.0 };
  const expected = haversineDistanceM(beyondB, b);
  APPROX_M(distanceToSegmentM(beyondB, a, b), expected, 1);
});
