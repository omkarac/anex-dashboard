/**
 * Spherical-Earth geodetic helpers.
 *
 * All distances in metres, all angles in degrees (compass, 0–360°).
 * The OLS engine operates over <30 km from any ARP, where the spherical
 * approximation is accurate to ~0.5 % vs. WGS-84 — well within the precision
 * of the surfaces themselves (decimetres).
 *
 * Reference: Aviation Formulary (Williams, 1996); ICAO Annex 14 Vol. I.
 */

import type { LatLon } from "./types.ts";

/** IUGG mean Earth radius (metres). */
const EARTH_R_M = 6_371_008.8;
const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

/** Great-circle distance between two points, metres. */
export function haversineDistanceM(a: LatLon, b: LatLon): number {
  const phi1 = a.lat * D2R;
  const phi2 = b.lat * D2R;
  const dPhi = (b.lat - a.lat) * D2R;
  const dLam = (b.lon - a.lon) * D2R;
  const sinDPhi2 = Math.sin(dPhi / 2);
  const sinDLam2 = Math.sin(dLam / 2);
  const h = sinDPhi2 * sinDPhi2 + Math.cos(phi1) * Math.cos(phi2) * sinDLam2 * sinDLam2;
  return 2 * EARTH_R_M * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Initial true bearing from `a` toward `b`, degrees (0–360, 0 = north). */
export function initialBearingDeg(a: LatLon, b: LatLon): number {
  const phi1 = a.lat * D2R;
  const phi2 = b.lat * D2R;
  const dLam = (b.lon - a.lon) * D2R;
  const y = Math.sin(dLam) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLam);
  const theta = Math.atan2(y, x) * R2D;
  return (theta + 360) % 360;
}

/** Project a point along a bearing by a distance, returning the new point. */
export function destinationPoint(
  origin: LatLon,
  bearingDeg: number,
  distanceM: number,
): LatLon {
  const delta = distanceM / EARTH_R_M;
  const theta = bearingDeg * D2R;
  const phi1 = origin.lat * D2R;
  const lam1 = origin.lon * D2R;

  const sinPhi2 = Math.sin(phi1) * Math.cos(delta) + Math.cos(phi1) * Math.sin(delta) * Math.cos(theta);
  const phi2 = Math.asin(sinPhi2);
  const y = Math.sin(theta) * Math.sin(delta) * Math.cos(phi1);
  const x = Math.cos(delta) - Math.sin(phi1) * sinPhi2;
  const lam2 = lam1 + Math.atan2(y, x);

  return {
    lat: phi2 * R2D,
    lon: ((lam2 * R2D + 540) % 360) - 180,
  };
}

/**
 * Signed cross-track distance, metres: shortest distance from `point` to the
 * great circle through `lineStart` and `lineEnd`. Positive ⇒ point lies to
 * the *right* of the direction lineStart → lineEnd; negative ⇒ to the left.
 */
export function crossTrackDistanceM(
  point: LatLon,
  lineStart: LatLon,
  lineEnd: LatLon,
): number {
  const d13 = haversineDistanceM(lineStart, point) / EARTH_R_M;
  const theta13 = initialBearingDeg(lineStart, point) * D2R;
  const theta12 = initialBearingDeg(lineStart, lineEnd) * D2R;
  return Math.asin(Math.sin(d13) * Math.sin(theta13 - theta12)) * EARTH_R_M;
}

/**
 * Along-track distance, metres: how far along the great circle from
 * `lineStart` toward `lineEnd` lies the closest approach to `point`.
 * Positive ⇒ beyond lineStart toward lineEnd; negative ⇒ behind lineStart.
 */
export function alongTrackDistanceM(
  point: LatLon,
  lineStart: LatLon,
  lineEnd: LatLon,
): number {
  const d13 = haversineDistanceM(lineStart, point) / EARTH_R_M;
  if (d13 === 0) return 0;
  const dxt = crossTrackDistanceM(point, lineStart, lineEnd) / EARTH_R_M;
  // numerical safety: ratio can drift outside [-1, 1] for nearly-coincident points
  const cosRatio = Math.cos(d13) / Math.cos(dxt);
  const clamped = Math.max(-1, Math.min(1, cosRatio));
  const dat = Math.acos(clamped) * EARTH_R_M;

  // Sign: positive iff point projects forward of lineStart along lineStart→lineEnd
  const theta12 = initialBearingDeg(lineStart, lineEnd);
  const theta13 = initialBearingDeg(lineStart, point);
  let diff = Math.abs(theta13 - theta12);
  if (diff > 180) diff = 360 - diff;
  return diff <= 90 ? dat : -dat;
}

/** Unsigned distance from `point` to a line *segment* (clipped at endpoints). */
export function distanceToSegmentM(
  point: LatLon,
  segStart: LatLon,
  segEnd: LatLon,
): number {
  const segLenM = haversineDistanceM(segStart, segEnd);
  const at = alongTrackDistanceM(point, segStart, segEnd);
  if (at < 0) return haversineDistanceM(point, segStart);
  if (at > segLenM) return haversineDistanceM(point, segEnd);
  return Math.abs(crossTrackDistanceM(point, segStart, segEnd));
}
