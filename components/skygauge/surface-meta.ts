/**
 * Presentation vocabulary for OLS surface kinds.
 *
 * Keeps the raw `SurfaceKind` string literals out of JSX (per the repo's
 * "no enum string literals in JSX" rule) and gives the result panel a single
 * source for human labels, one-line explanations, and accent colours. The
 * accent hexes intentionally match the footprint colours drawn on the map so
 * the panel and the canvas read as one system.
 */

import type { SurfaceKind } from '@/skygauge/api/ols/types';

export interface SurfaceMeta {
  /** Human label, e.g. "Take-off Climb". */
  readonly label: string;
  /** One-line plain-English description of what the surface protects. */
  readonly blurb: string;
  /** Accent colour for dots / bars; aligned with the map footprint palette. */
  readonly color: string;
}

export const SURFACE_META: Record<SurfaceKind, SurfaceMeta> = {
  inner_horizontal: {
    label: 'Inner Horizontal',
    blurb: 'Flat disc 45 m above aerodrome elevation',
    color: '#0ea5e9',
  },
  conical: {
    label: 'Conical',
    blurb: 'Rises outward at 5 % from the inner-horizontal rim',
    color: '#6366f1',
  },
  outer_horizontal: {
    label: 'Outer Horizontal',
    blurb: 'Flat disc 150 m above aerodrome elevation',
    color: '#14b8a6',
  },
  approach: {
    label: 'Approach',
    blurb: 'Inclined surface protecting the final-approach path',
    color: '#185fa5',
  },
  takeoff_climb: {
    label: 'Take-off Climb',
    blurb: 'Inclined surface protecting the departure climb',
    color: '#7c3aed',
  },
  transitional: {
    label: 'Transitional',
    blurb: 'Steep side surface rising from the strip edge',
    color: '#b45309',
  },
};

/** Label for a surface kind. */
export function surfaceLabel(kind: SurfaceKind): string {
  return SURFACE_META[kind].label;
}
