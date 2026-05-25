/**
 * Skygauge 3D scene geometry.
 *
 * Pure, dependency-light builders for the 3D view. Everything is placed through
 * a single calibrated ENU projection (`projectToScene`) so the OLS-ceiling
 * heightfield AND the nearby NOC/appeal structures share one coordinate frame —
 * distances between structures and the site match the real lat/lon geometry.
 *
 * Frame: local ENU centred on the site. x = East, z = −North, y = Up.
 * Horizontal metres are scaled by `horizScale`; vertical is additionally
 * exaggerated by `vertExag` so tens-of-metres height reads against the
 * kilometre footprint.
 */

import { computeOLSLimit } from '@/skygauge/api/ols/engine';
import type { LatLon } from '@/skygauge/api/ols/types';

import { SURFACE_META } from './surface-meta';

export const SCENE = {
  /** Default half-extent of the sampled area around the site, metres. */
  radiusM: 1200,
  /** Grid cells per axis (so (grid+1)² vertices). */
  grid: 28,
  /** Metres → scene units (horizontal). */
  horizScale: 1 / 50,
  /** Vertical exaggeration applied on top of horizScale. */
  vertExag: 4,
} as const;

const M_PER_DEG_LAT = 111_320;
const UNCONSTRAINED_COLOR: [number, number, number] = [0.6, 0.62, 0.66];

/** How metres map to scene units. The abstract 3D scene exaggerates; the
 *  photoreal (Google Tiles) overlay is real-world 1:1 so it sits on the mesh. */
export interface SceneFrame {
  readonly horizScale: number;
  readonly vertExag: number;
}
export const ABSTRACT_FRAME: SceneFrame = { horizScale: SCENE.horizScale, vertExag: SCENE.vertExag };
export const REAL_FRAME: SceneFrame = { horizScale: 1, vertExag: 1 };

export interface ScenePoint {
  /** Scene-space coordinates. */
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Ground-plane offset from the site, metres (East / North). */
  readonly east: number;
  readonly north: number;
  /** Great-circle-ish ground distance from the site, metres. */
  readonly distanceM: number;
}

/**
 * The one calibrated projection: (lat, lon, amsl) → scene space, relative to the
 * site origin. `groundAmsl` is the y = 0 datum. Local equirectangular projection
 * (cos-corrected longitude) — sub-metre accurate over the OLS footprint.
 */
export function projectToScene(
  site: LatLon,
  lat: number,
  lon: number,
  amsl: number,
  groundAmsl: number,
  frame: SceneFrame = ABSTRACT_FRAME,
): ScenePoint {
  const mPerDegLon = M_PER_DEG_LAT * Math.cos((site.lat * Math.PI) / 180);
  const east = (lon - site.lon) * mPerDegLon;
  const north = (lat - site.lat) * M_PER_DEG_LAT;
  return {
    x: east * frame.horizScale,
    y: (amsl - groundAmsl) * frame.vertExag * frame.horizScale,
    z: -north * frame.horizScale,
    east,
    north,
    distanceM: Math.hypot(east, north),
  };
}

export interface OlsHeightfield {
  readonly positions: Float32Array;
  readonly colors: Float32Array;
  readonly indices: Uint32Array;
  readonly siteCeilingAmsl: number | null;
  readonly baselineAmsl: number;
  readonly siteCeilingY: number | null;
  readonly spanUnits: number;
  readonly radiusM: number;
  readonly hasData: boolean;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    Number.parseInt(h.slice(0, 2), 16) / 255,
    Number.parseInt(h.slice(2, 4), 16) / 255,
    Number.parseInt(h.slice(4, 6), 16) / 255,
  ];
}

/**
 * Build the OLS-ceiling heightfield around `site`. `groundAmsl` sets the y = 0
 * datum; `radiusM` the half-extent (defaults to SCENE.radiusM).
 */
export function buildOlsHeightfield(
  site: LatLon,
  groundAmsl = 0,
  radiusM: number = SCENE.radiusM,
  frame: SceneFrame = ABSTRACT_FRAME,
): OlsHeightfield {
  const { grid } = SCENE;
  const n = grid + 1;
  const mPerDegLon = M_PER_DEG_LAT * Math.cos((site.lat * Math.PI) / 180);

  const positions = new Float32Array(n * n * 3);
  const colors = new Float32Array(n * n * 3);
  const finite = new Array<boolean>(n * n).fill(false);

  let hasData = false;

  for (let i = 0; i < n; i++) {
    const north = (i / grid - 0.5) * 2 * radiusM;
    const lat = site.lat + north / M_PER_DEG_LAT;
    for (let j = 0; j < n; j++) {
      const east = (j / grid - 0.5) * 2 * radiusM;
      const lon = site.lon + east / mPerDegLon;

      const r = computeOLSLimit({ lat, lon });
      const idx = i * n + j;
      const amsl = r.max_top_amsl_m;
      const p = projectToScene(site, lat, lon, amsl ?? groundAmsl, groundAmsl, frame);

      positions[idx * 3] = p.x;
      positions[idx * 3 + 1] = p.y;
      positions[idx * 3 + 2] = p.z;

      if (amsl !== null && r.binding) {
        const [cr, cg, cb] = hexToRgb(SURFACE_META[r.binding.surface].color);
        colors[idx * 3] = cr;
        colors[idx * 3 + 1] = cg;
        colors[idx * 3 + 2] = cb;
        finite[idx] = true;
        hasData = true;
      } else {
        [colors[idx * 3], colors[idx * 3 + 1], colors[idx * 3 + 2]] = UNCONSTRAINED_COLOR;
      }
    }
  }

  const indices: number[] = [];
  for (let i = 0; i < grid; i++) {
    for (let j = 0; j < grid; j++) {
      const a = i * n + j;
      const b = a + 1;
      const c = a + n;
      const d = c + 1;
      if (finite[a] && finite[b] && finite[c] && finite[d]) {
        indices.push(a, c, b, b, c, d);
      }
    }
  }

  const siteResult = computeOLSLimit({ lat: site.lat, lon: site.lon });
  const siteCeilingAmsl = siteResult.max_top_amsl_m;
  const siteCeilingY =
    siteCeilingAmsl !== null
      ? projectToScene(site, site.lat, site.lon, siteCeilingAmsl, groundAmsl, frame).y
      : null;

  return {
    positions,
    colors,
    indices: Uint32Array.from(indices),
    siteCeilingAmsl,
    baselineAmsl: groundAmsl,
    siteCeilingY,
    spanUnits: radiusM * frame.horizScale,
    radiusM,
    hasData,
  };
}
