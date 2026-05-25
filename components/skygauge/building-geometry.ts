/**
 * Procedural building massings for the 3D scene.
 *
 * Each architectural style is a single merged THREE.BufferGeometry normalised to
 * a UNIT building — footprint within ±0.5, base at y = 0, apex at y = 1 — so it
 * can be instanced and scaled per structure (footprint on x/z, approved-top
 * height on y). Style is chosen deterministically from the NOC id (stable across
 * renders) and biased by height: short permits get low-rise forms, tall ones get
 * towers.
 *
 * Browser-only (imported by the ssr:false scene). No engine/data coupling.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type BuildingStyle = 'flat' | 'setback' | 'taper' | 'pitched' | 'cylinder';

const TOWER_STYLES: readonly BuildingStyle[] = ['flat', 'setback', 'taper', 'cylinder'];
const LOWRISE_STYLES: readonly BuildingStyle[] = ['flat', 'pitched'];
const LOWRISE_MAX_M = 22;

export const ALL_STYLES: readonly BuildingStyle[] = [
  'flat',
  'setback',
  'taper',
  'pitched',
  'cylinder',
];

function merge(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const m = mergeGeometries(geos, false);
  if (!m) throw new Error('mergeGeometries failed — incompatible attributes');
  return m;
}

/** Axis-aligned box spanning [y0,y1] in height, w×d footprint, centred on x/z. */
function box(w: number, d: number, y0: number, y1: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, y1 - y0, d);
  g.translate(0, (y0 + y1) / 2, 0);
  return g;
}

/** N-sided vertical solid (cone when radiusTop = 0), spanning [y0,y1]. */
function cyl(
  rTop: number,
  rBot: number,
  y0: number,
  y1: number,
  seg: number,
  squareAlign = false,
): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(rTop, rBot, y1 - y0, seg);
  if (squareAlign) g.rotateY(Math.PI / 4);
  g.translate(0, (y0 + y1) / 2, 0);
  return g;
}

function unitFor(style: BuildingStyle): THREE.BufferGeometry {
  switch (style) {
    case 'flat':
      return box(0.9, 0.9, 0, 1);
    case 'setback':
      return merge([
        box(1.0, 1.0, 0, 0.5),
        box(0.72, 0.72, 0.5, 0.8),
        box(0.46, 0.46, 0.8, 1.0),
      ]);
    case 'taper':
      // 4-sided tapered prism (square cross-section).
      return cyl(0.34, 0.52, 0, 1, 4, true);
    case 'pitched':
      // Low-rise body + 4-sided hip roof.
      return merge([box(0.9, 0.9, 0, 0.68), cyl(0, 0.66, 0.68, 1.0, 4, true)]);
    case 'cylinder':
      // Round tower + slender spire cap.
      return merge([cyl(0.42, 0.42, 0, 0.9, 16), cyl(0, 0.16, 0.9, 1.0, 12)]);
  }
}

/** Build all unit geometries once (call inside a useMemo). */
export function buildUnitBuildings(): Record<BuildingStyle, THREE.BufferGeometry> {
  return {
    flat: unitFor('flat'),
    setback: unitFor('setback'),
    taper: unitFor('taper'),
    pitched: unitFor('pitched'),
    cylinder: unitFor('cylinder'),
  };
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic style for a structure, biased to low-rise forms when short. */
export function pickBuildingStyle(seed: string, heightM: number): BuildingStyle {
  const pool = heightM < LOWRISE_MAX_M ? LOWRISE_STYLES : TOWER_STYLES;
  return pool[hashString(seed) % pool.length];
}

/** Deterministic footprint half-width in scene units (~17–27 m at 1/50 scale). */
export function buildingFootprintUnits(seed: string): number {
  return 0.34 + (hashString(`${seed}:fp`) % 5) * 0.05; // 0.34 .. 0.54
}

/** Deterministic footprint half-width in metres (for real-world / photoreal scale). */
export function buildingFootprintMeters(seed: string): number {
  return 17 + (hashString(`${seed}:fp`) % 5) * 2.5; // 17 .. 27 m
}
