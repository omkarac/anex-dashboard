/**
 * Pure overlay descriptors for the photoreal mode.
 *
 * Each NOC / appeal / site is a small stack of extruded `Polygon3D` segments
 * — that's what makes a building visibly cylindrical, stepped, tapered, or
 * pitched. We went through a glTF path via `Model3DElement` first; Map3D's
 * alpha renderer collapses those to bounding boxes (every building ends up
 * as a uniform rectangular block), so we drive shape variety with polygon
 * stacks instead. `Polygon3DInteractiveElement` is declarative geometry the
 * renderer can't simplify, and it carries `gmp-click` (with hover events on
 * the runtimes that ship them).
 *
 * The OLS heightfield is still flat tilted `Polygon3D` quads — no shape
 * change needed there.
 *
 * Pure data builders. No DOM, no three.js, no React.
 */

import { computeOLSLimit } from '@/skygauge/api/ols/engine';
import type { LatLon, OLSResult } from '@/skygauge/api/ols/types';
import type { NearbyAppeal, NearbyNoc } from '@/skygauge/api/empirical/types';

import {
  buildingFootprintMeters,
  pickBuildingStyle,
  type BuildingStyle,
} from './building-geometry';
import { SURFACE_META } from './surface-meta';

const M_PER_DEG_LAT = 111_320;
const CEILING_GRID = 12;
const SITE_FOOTPRINT_M = 32;
const SITE_STYLE: BuildingStyle = 'setback';
const MIN_HEIGHT_M = 3;
/** How many sides the polygon ring of a cylinder body uses. 16 reads as
 *  smoothly round from a typical photoreal viewing distance and keeps each
 *  Polygon3D element's vertex count modest. */
const CYLINDER_SIDES = 16;

export interface LatLngAlt {
  readonly lat: number;
  readonly lng: number;
  readonly altitude: number;
}

export interface CeilingCell {
  readonly key: string;
  readonly ring: readonly LatLngAlt[];
  readonly fillColor: string;
}

export type PillarKind = 'noc' | 'noc_restricted' | 'appeal' | 'site';

/** One extruded slab of a building. The ring's altitudes (relative to the
 *  local ground via `RELATIVE_TO_GROUND`) define the slab's top; Map3D
 *  extrudes downward to the terrain to draw the visible walls. */
export interface PillarSegment {
  readonly key: string;
  readonly ring: readonly LatLngAlt[];
}

export interface PillarOverlay {
  readonly key: string;
  readonly kind: PillarKind;
  readonly fillColor: string;
  /** Permitted top, m AMSL — original value, for the hover label. */
  readonly topAmsl: number;
  /** Anchor used to position the floating height label. */
  readonly centre: LatLngAlt;
  readonly label: string;
  readonly style: BuildingStyle;
  readonly footprintM: number;
  readonly heightM: number;
  readonly groundAmsl: number;
  /** Stack of extruded polygons composing the building's silhouette. */
  readonly segments: readonly PillarSegment[];
  /** AAI NOC identifier (for NOCs + appeals; null for the site massing). */
  readonly nocId: string | null;
  /** Appellate committee meeting date, ISO. Null for non-appeal records. */
  readonly meetingDate: string | null;
}

export const PILLAR_COLORS: Record<PillarKind, string> = {
  noc: '#10b981',
  noc_restricted: '#f43f5e',
  appeal: '#8b5cf6',
  site: '#f59e0b',
};

// ─── Ring helpers ─────────────────────────────────────────────────────────────

function offsetToLatLon(site: LatLon, eastM: number, northM: number): { lat: number; lon: number } {
  const mPerDegLon = M_PER_DEG_LAT * Math.cos((site.lat * Math.PI) / 180);
  return {
    lat: site.lat + northM / M_PER_DEG_LAT,
    lon: site.lon + eastM / mPerDegLon,
  };
}

/** Square ring around `centre`, side `sideM` long, top at `altitude`. */
function squareRing(centre: LatLon, sideM: number, altitude: number): LatLngAlt[] {
  const half = sideM / 2;
  const corners: Array<[number, number]> = [
    [-half, -half],
    [half, -half],
    [half, half],
    [-half, half],
    [-half, -half],
  ];
  return corners.map(([e, n]) => {
    const { lat, lon } = offsetToLatLon(centre, e, n);
    return { lat, lng: lon, altitude };
  });
}

/** N-sided regular polygon ring around `centre`, top at `altitude`. */
function ngonRing(
  centre: LatLon,
  radiusM: number,
  altitude: number,
  sides: number,
): LatLngAlt[] {
  const ring: LatLngAlt[] = [];
  for (let i = 0; i <= sides; i++) {
    const theta = (i / sides) * 2 * Math.PI;
    const east = Math.cos(theta) * radiusM;
    const north = Math.sin(theta) * radiusM;
    const { lat, lon } = offsetToLatLon(centre, east, north);
    ring.push({ lat, lng: lon, altitude });
  }
  return ring;
}

// ─── Per-style segment generators ─────────────────────────────────────────────
//
// Each style returns a stack of segments. Polygon3D extrudes each segment
// from its ring altitude down to the ground; nesting smaller polygons on top
// of larger ones (each extruded to ground) builds the setback / taper /
// pitched / spired silhouettes — the outer face at each altitude is whichever
// polygon's ring is widest at that level.
//
// Footprint multipliers are in [0, 1] and apply to `footprintM`. Heights are
// in [0, 1] and apply to `heightM`. They mirror the unit ratios used by the
// abstract 3D scene's THREE merged geometries (`building-geometry.ts`), so
// the two views show the same architectural family.

function segmentsFor(
  centre: LatLon,
  style: BuildingStyle,
  footprintM: number,
  heightM: number,
): PillarSegment[] {
  switch (style) {
    case 'flat':
      return [
        {
          key: 'l0',
          ring: squareRing(centre, footprintM * 0.9, heightM),
        },
      ];

    case 'setback':
      return [
        { key: 'l0', ring: squareRing(centre, footprintM * 1.0, heightM * 0.5) },
        { key: 'l1', ring: squareRing(centre, footprintM * 0.72, heightM * 0.8) },
        { key: 'l2', ring: squareRing(centre, footprintM * 0.46, heightM * 1.0) },
      ];

    case 'taper':
      // 4-layer staircase approximation of a tapered prism (square section).
      return [
        { key: 'l0', ring: squareRing(centre, footprintM * 1.0, heightM * 0.25) },
        { key: 'l1', ring: squareRing(centre, footprintM * 0.78, heightM * 0.5) },
        { key: 'l2', ring: squareRing(centre, footprintM * 0.55, heightM * 0.75) },
        { key: 'l3', ring: squareRing(centre, footprintM * 0.34, heightM * 1.0) },
      ];

    case 'pitched':
      // Low-rise body + a smaller "roof" cap on top.
      return [
        { key: 'l0', ring: squareRing(centre, footprintM * 0.9, heightM * 0.68) },
        { key: 'l1', ring: squareRing(centre, footprintM * 0.4, heightM * 1.0) },
      ];

    case 'cylinder':
      // Round body (16-gon → reads as smooth at viewing distance) + spire.
      return [
        {
          key: 'body',
          ring: ngonRing(centre, footprintM * 0.42, heightM * 0.9, CYLINDER_SIDES),
        },
        { key: 'spire', ring: squareRing(centre, footprintM * 0.16, heightM * 1.0) },
      ];
  }
}

// ─── Public builders ──────────────────────────────────────────────────────────

export function buildCeilingCells(site: LatLon, radiusM: number): CeilingCell[] {
  const n = CEILING_GRID + 1;
  const mPerDegLon = M_PER_DEG_LAT * Math.cos((site.lat * Math.PI) / 180);

  const vertices: Array<{ lat: number; lon: number; result: OLSResult }> = [];
  for (let i = 0; i < n; i++) {
    const north = (i / CEILING_GRID - 0.5) * 2 * radiusM;
    const lat = site.lat + north / M_PER_DEG_LAT;
    for (let j = 0; j < n; j++) {
      const east = (j / CEILING_GRID - 0.5) * 2 * radiusM;
      const lon = site.lon + east / mPerDegLon;
      vertices.push({ lat, lon, result: computeOLSLimit({ lat, lon }) });
    }
  }

  const cells: CeilingCell[] = [];
  for (let i = 0; i < CEILING_GRID; i++) {
    for (let j = 0; j < CEILING_GRID; j++) {
      const a = vertices[i * n + j];
      const b = vertices[i * n + j + 1];
      const c = vertices[(i + 1) * n + j];
      const d = vertices[(i + 1) * n + j + 1];

      const aAmsl = a.result.max_top_amsl_m;
      const bAmsl = b.result.max_top_amsl_m;
      const cAmsl = c.result.max_top_amsl_m;
      const dAmsl = d.result.max_top_amsl_m;
      if (aAmsl === null || bAmsl === null || cAmsl === null || dAmsl === null) continue;

      const centreLat = (a.lat + d.lat) / 2;
      const centreLon = (a.lon + d.lon) / 2;
      const centreResult = computeOLSLimit({ lat: centreLat, lon: centreLon });
      const binding = centreResult.binding;
      if (!binding) continue;

      const fillColor = SURFACE_META[binding.surface].color;

      cells.push({
        key: `cell-${i}-${j}`,
        ring: [
          { lat: a.lat, lng: a.lon, altitude: aAmsl },
          { lat: b.lat, lng: b.lon, altitude: bAmsl },
          { lat: d.lat, lng: d.lon, altitude: dAmsl },
          { lat: c.lat, lng: c.lon, altitude: cAmsl },
          { lat: a.lat, lng: a.lon, altitude: aAmsl },
        ],
        fillColor,
      });
    }
  }
  return cells;
}

export function buildSiteMassing(
  site: LatLon,
  groundAmsl: number,
  result: { max_top_amsl_m: number | null } | null,
): PillarOverlay | null {
  const amsl = result?.max_top_amsl_m;
  if (amsl === null || amsl === undefined) return null;
  const heightM = Math.max(amsl - groundAmsl, MIN_HEIGHT_M);
  return {
    key: 'site-massing',
    kind: 'site',
    fillColor: PILLAR_COLORS.site,
    topAmsl: amsl,
    centre: { lat: site.lat, lng: site.lon, altitude: amsl },
    label: 'Buildable site massing',
    style: SITE_STYLE,
    footprintM: SITE_FOOTPRINT_M,
    heightM,
    groundAmsl,
    segments: segmentsFor(site, SITE_STYLE, SITE_FOOTPRINT_M, heightM),
    nocId: null,
    meetingDate: null,
  };
}

export function buildPillars(
  site: LatLon,
  radiusM: number,
  nocs: readonly NearbyNoc[],
  appeals: readonly NearbyAppeal[],
  groundAmsl = 0,
): PillarOverlay[] {
  const out: PillarOverlay[] = [];

  nocs.forEach((noc, i) => {
    if (noc.lat === null || noc.lon === null || noc.permissible_top_m === null) return;
    if (noc.distance_m > radiusM) return;
    const id = `noc-${noc.noc_id ?? i}`;
    const centre: LatLon = { lat: noc.lat, lon: noc.lon };
    const kind: PillarKind = noc.is_restricted ? 'noc_restricted' : 'noc';
    const heightM = Math.max(noc.permissible_top_m - groundAmsl, MIN_HEIGHT_M);
    const style = pickBuildingStyle(id, heightM);
    const footprintM = buildingFootprintMeters(id);
    out.push({
      key: id,
      kind,
      fillColor: PILLAR_COLORS[kind],
      topAmsl: noc.permissible_top_m,
      centre: { lat: noc.lat, lng: noc.lon, altitude: noc.permissible_top_m },
      label: noc.is_restricted ? 'Restricted NOC' : 'Issued NOC',
      style,
      footprintM,
      heightM,
      groundAmsl,
      segments: segmentsFor(centre, style, footprintM, heightM),
      nocId: noc.noc_id,
      meetingDate: null,
    });
  });

  appeals.forEach((appeal, i) => {
    if (appeal.lat === null || appeal.lon === null || appeal.approved_top_m === null) return;
    if (appeal.distance_m > radiusM) return;
    const id = `appeal-${appeal.noc_id ?? i}-${appeal.meeting_date ?? i}`;
    const centre: LatLon = { lat: appeal.lat, lon: appeal.lon };
    const heightM = Math.max(appeal.approved_top_m - groundAmsl, MIN_HEIGHT_M);
    const style = pickBuildingStyle(id, heightM);
    const footprintM = buildingFootprintMeters(id);
    out.push({
      key: id,
      kind: 'appeal',
      fillColor: PILLAR_COLORS.appeal,
      topAmsl: appeal.approved_top_m,
      centre: { lat: appeal.lat, lng: appeal.lon, altitude: appeal.approved_top_m },
      label: 'Appellate case',
      style,
      footprintM,
      heightM,
      groundAmsl,
      segments: segmentsFor(centre, style, footprintM, heightM),
      nocId: appeal.noc_id,
      meetingDate: appeal.meeting_date,
    });
  });

  return out;
}
