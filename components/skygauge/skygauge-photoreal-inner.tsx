'use client';

/**
 * Skygauge Photoreal — Google's native Map3DElement.
 *
 * The renderer is the `maps3d` library on the Maps JS API (v=alpha). The
 * React layer only:
 *   1. Mounts `<gmp-map-3d>` once and pans via `flyCameraTo` on site change.
 *   2. Recomputes overlay descriptors when site / elevation / data change.
 *   3. Replaces overlay children imperatively.
 *
 * Structures are rendered as **stacks of `Polygon3DInteractiveElement`s** —
 * one extruded polygon per slab of the building. We tried `Model3DElement`
 * driven by GLBs of the procedural shapes from `building-geometry.ts`, but
 * Map3D's alpha glTF path collapses the model to its bounding box, so every
 * building rendered as a uniform rectangular block. Stacked extruded
 * polygons are declarative geometry the renderer can't simplify; they read
 * as proper setback / taper / pitched / cylinder silhouettes.
 *
 * Datum: native AMSL on the OLS ceiling cells (`ABSOLUTE`); buildings sit on
 * the real terrain via `RELATIVE_TO_GROUND` so they're insensitive to local
 * AMSL drift vs the site's measured ground.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from 'next-themes';

import { loadMap3DLibrary } from './google-maps-loader';
import { computeOLSLimit } from '@/skygauge/api/ols/engine';
import type { LatLon } from '@/skygauge/api/ols/types';
import type { NearbyAppeal, NearbyNoc } from '@/skygauge/api/empirical/types';

import {
  buildCeilingCells,
  buildPillars,
  buildSiteMassing,
  PILLAR_COLORS,
  type LatLngAlt,
  type PillarOverlay,
} from './photoreal-overlays';

const DEFAULT_RADIUS_M = 1200;

// Map3D's alpha runtime emits hover events on Polygon3DInteractiveElement
// under inconsistent names across versions — attaching them all is harmless
// and ensures we catch whichever the deployed runtime fires.
const HOVER_ENTER_EVENTS = [
  'gmp-pointerenter',
  'gmp-pointerover',
  'gmp-mouseenter',
  'gmp-mouseover',
] as const;
const HOVER_LEAVE_EVENTS = [
  'gmp-pointerleave',
  'gmp-pointerout',
  'gmp-mouseleave',
  'gmp-mouseout',
] as const;
/** Hover leave is debounced so moving the cursor between segments of the
 *  same building (one extruded polygon per setback/taper slab) doesn't
 *  flicker the floating label between visible and hidden. */
const HOVER_LEAVE_DELAY_MS = 80;

// ─── Minimal Map3D typings — @types/google.maps doesn't ship maps3d yet ──────

type AltitudeModeValue =
  | 'ABSOLUTE'
  | 'CLAMP_TO_GROUND'
  | 'RELATIVE_TO_GROUND'
  | 'RELATIVE_TO_MESH';

type Map3DMode = 'HYBRID' | 'SATELLITE';

interface LatLngAltitudeInit {
  lat: number;
  lng: number;
  altitude: number;
}

interface Map3DCameraOptions {
  center: LatLngAltitudeInit;
  tilt?: number;
  heading?: number;
  range?: number;
  roll?: number;
}

interface Map3DElement extends HTMLElement {
  center: LatLngAltitudeInit;
  tilt: number;
  heading: number;
  range: number;
  mode: Map3DMode;
  defaultLabelsDisabled: boolean;
  flyCameraTo(options: { endCamera: Map3DCameraOptions; durationMillis?: number }): void;
}

interface Polygon3DElement extends HTMLElement {
  outerCoordinates: readonly LatLngAlt[];
  altitudeMode: AltitudeModeValue;
  extruded: boolean;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  drawsOccludedSegments: boolean;
}

type Polygon3DInteractiveElement = Polygon3DElement;

interface Marker3DElement extends HTMLElement {
  position: LatLngAltitudeInit;
  altitudeMode: AltitudeModeValue;
  label: string;
}

interface Map3DLibrary {
  Map3DElement: new (options: Map3DCameraOptions & { mode?: Map3DMode }) => Map3DElement;
  Polygon3DElement: new () => Polygon3DElement;
  Polygon3DInteractiveElement?: new () => Polygon3DInteractiveElement;
  Marker3DElement: new () => Marker3DElement;
  AltitudeMode?: Record<AltitudeModeValue, AltitudeModeValue>;
}

interface SkygaugePhotorealInnerProps {
  site: LatLon;
  elevationM?: number;
  radiusM?: number;
  nocs?: NearbyNoc[];
  appeals?: NearbyAppeal[];
  height?: string;
  /** Threaded down from `SkygaugePhotoreal` (non-dynamic wrapper) so we never
   *  depend on Next.js / Turbopack inlining `NEXT_PUBLIC_*` env vars into
   *  this dynamically-imported chunk. */
  googleKey?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SkygaugePhotorealInner({
  site,
  elevationM,
  radiusM = DEFAULT_RADIUS_M,
  nocs = [],
  appeals = [],
  height = '100%',
  googleKey,
}: SkygaugePhotorealInnerProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map3DElement | null>(null);
  const libRef = useRef<Map3DLibrary | null>(null);
  const overlaysRef = useRef<HTMLElement[]>([]);
  const labelMarkerRef = useRef<Marker3DElement | null>(null);
  // Lookup from a polygon DOM node back to its descriptor so click/hover
  // handlers surface the right height data. Multiple polygons per pillar all
  // resolve to the same `PillarOverlay`.
  const pillarByElementRef = useRef<WeakMap<HTMLElement, PillarOverlay>>(new WeakMap());
  const initialSiteRef = useRef<LatLon>(site);
  // Debounce timer for hover-leave. Multiple polygon segments per building
  // can fire enter/leave rapidly as the cursor moves between them; we delay
  // the "clear selection" so a leave-then-enter on the same building doesn't
  // flicker the floating label.
  const hoverLeaveTimerRef = useRef<number | null>(null);

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [showLabels, setShowLabels] = useState(false);
  const [showCeiling, setShowCeiling] = useState(false);
  const [selectedPillar, setSelectedPillar] = useState<PillarOverlay | null>(null);

  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === 'dark';

  // ── Mount the Map3D element. Recreated only on Retry (retryNonce changes).
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;
    setStatus('loading');
    setErrorMessage(null);

    loadMap3DLibrary(googleKey)
      .then((lib) => {
        if (cancelled || !hostRef.current) return;
        const m3d = lib as Map3DLibrary;
        if (typeof m3d?.Map3DElement !== 'function') {
          throw new Error(
            'maps3d resolved but Map3DElement constructor is missing — channel mismatch?',
          );
        }
        libRef.current = m3d;

        const initialSite = initialSiteRef.current;
        const map = new m3d.Map3DElement({
          center: { lat: initialSite.lat, lng: initialSite.lon, altitude: 250 },
          range: 1200,
          tilt: 67,
          heading: 0,
          mode: 'SATELLITE',
        });
        map.defaultLabelsDisabled = true;
        map.style.width = '100%';
        map.style.height = '100%';

        // Background click — only clears the selection if no pillar element
        // was in the click path (pillar handlers stop propagation).
        map.addEventListener('gmp-click', (event: Event) => {
          const composed =
            (event as Event & { composedPath?: () => EventTarget[] }).composedPath?.() ?? [];
          const hitPillar = composed.some(
            (node) => node instanceof HTMLElement && pillarByElementRef.current.has(node),
          );
          if (!hitPillar) setSelectedPillar(null);
        });

        host.appendChild(map);
        mapRef.current = map;
        setStatus('ready');
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : 'Failed to load photoreal';
        console.error('[skygauge/photoreal] load failed:', error);
        setStatus('error');
        setErrorMessage(message);
      });

    return () => {
      cancelled = true;
      if (hoverLeaveTimerRef.current !== null) {
        window.clearTimeout(hoverLeaveTimerRef.current);
        hoverLeaveTimerRef.current = null;
      }
      const map = mapRef.current;
      if (map && host.contains(map)) host.removeChild(map);
      mapRef.current = null;
      libRef.current = null;
      overlaysRef.current = [];
      labelMarkerRef.current = null;
      pillarByElementRef.current = new WeakMap();
    };
    // `googleKey` is a stable, build-time-resolved string — re-running the
    // mount effect on it would tear down the live map for no real reason.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryNonce]);

  // ── Mode + label toggle is a single property update on the live element.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== 'ready') return;
    map.mode = showLabels ? 'HYBRID' : 'SATELLITE';
    map.defaultLabelsDisabled = !showLabels;
  }, [showLabels, status]);

  // ── Recompute overlay descriptors when site / elevation / data change.
  const groundAmsl = elevationM ?? 0;
  const siteResult = useMemo(
    () => computeOLSLimit({ lat: site.lat, lon: site.lon, elevation_m: elevationM }),
    [site, elevationM],
  );
  const ceilingCells = useMemo(() => buildCeilingCells(site, radiusM), [site, radiusM]);
  const siteMassing = useMemo(
    () => buildSiteMassing(site, groundAmsl, siteResult),
    [site, groundAmsl, siteResult],
  );
  const pillars = useMemo(
    () => buildPillars(site, radiusM, nocs, appeals, groundAmsl),
    [site, radiusM, nocs, appeals, groundAmsl],
  );

  // ── Apply descriptors imperatively. Synchronous — no GLB pipeline.
  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!map || !lib || status !== 'ready') return;

    // Tear down previous overlays deterministically.
    for (const node of overlaysRef.current) {
      if (node.parentNode === map) map.removeChild(node);
    }
    overlaysRef.current = [];
    pillarByElementRef.current = new WeakMap();

    const altAbs: AltitudeModeValue = lib.AltitudeMode?.ABSOLUTE ?? 'ABSOLUTE';
    const altRel: AltitudeModeValue =
      lib.AltitudeMode?.RELATIVE_TO_GROUND ?? 'RELATIVE_TO_GROUND';
    const PolyInteractive = lib.Polygon3DInteractiveElement ?? lib.Polygon3DElement;

    // Hover bookkeeping — debounced leave avoids flicker between segments of
    // the same building.
    const handlePillarEnter = (pillar: PillarOverlay) => {
      if (hoverLeaveTimerRef.current !== null) {
        window.clearTimeout(hoverLeaveTimerRef.current);
        hoverLeaveTimerRef.current = null;
      }
      setSelectedPillar(pillar);
    };
    const handlePillarLeave = (pillar: PillarOverlay) => {
      if (hoverLeaveTimerRef.current !== null) {
        window.clearTimeout(hoverLeaveTimerRef.current);
      }
      hoverLeaveTimerRef.current = window.setTimeout(() => {
        hoverLeaveTimerRef.current = null;
        setSelectedPillar((current) => (current?.key === pillar.key ? null : current));
      }, HOVER_LEAVE_DELAY_MS);
    };

    const created: HTMLElement[] = [];
    const allPillars: PillarOverlay[] = siteMassing ? [...pillars, siteMassing] : pillars;

    // 1. OLS ceiling cells (only when the user toggled them on).
    if (showCeiling) {
      for (const cell of ceilingCells) {
        const poly = new lib.Polygon3DElement();
        poly.altitudeMode = altAbs;
        poly.extruded = false;
        poly.fillColor = withAlpha(cell.fillColor, 0.18);
        poly.strokeColor = withAlpha(cell.fillColor, 0.55);
        poly.strokeWidth = 1;
        poly.drawsOccludedSegments = false;
        poly.outerCoordinates = cell.ring;
        map.appendChild(poly);
        created.push(poly);
      }
    }

    // 2. Pillars — one extruded polygon per segment. Nested polygons stack
    //    to make setback / taper / pitched / cylinder silhouettes (smaller
    //    polygons extrude through the larger ones; the widest ring at each
    //    altitude is what's visible from outside).
    for (const pillar of allPillars) {
      for (const segment of pillar.segments) {
        const poly = new PolyInteractive() as Polygon3DInteractiveElement;
        poly.altitudeMode = altRel;
        poly.extruded = true;
        poly.fillColor = withAlpha(pillar.fillColor, 0.92);
        poly.strokeColor = pillar.fillColor;
        poly.strokeWidth = 1.4;
        // Pillars must draw through the (translucent) OLS ceiling when it's
        // enabled — otherwise the segments behind the ceiling vanish.
        poly.drawsOccludedSegments = true;
        poly.outerCoordinates = segment.ring;

        pillarByElementRef.current.set(poly, pillar);

        poly.addEventListener('gmp-click', (event: Event) => {
          event.stopPropagation();
          handlePillarEnter(pillar);
        });
        // Map3D's alpha channel ships hover events on Polygon3DInteractiveElement
        // under inconsistent names across runtimes — some emit `gmp-pointerenter`,
        // others `gmp-pointerover` or `gmp-mouseover`. Attach all of them; the
        // ones the runtime doesn't fire are a no-op, and any of them is enough
        // to drive the same handler.
        for (const evt of HOVER_ENTER_EVENTS) {
          poly.addEventListener(evt, () => handlePillarEnter(pillar));
        }
        for (const evt of HOVER_LEAVE_EVENTS) {
          poly.addEventListener(evt, () => handlePillarLeave(pillar));
        }

        map.appendChild(poly);
        created.push(poly);
      }
    }

    // 3. Shared label marker — hidden until a pillar is picked.
    const marker = new lib.Marker3DElement();
    marker.altitudeMode = altRel;
    marker.position = { lat: site.lat, lng: site.lon, altitude: 0 };
    marker.style.display = 'none';
    map.appendChild(marker);
    labelMarkerRef.current = marker;
    created.push(marker);

    overlaysRef.current = created;
    console.info(
      `[skygauge/photoreal] mounted ${allPillars.length} structures (${created.length} elements)`,
    );
  }, [status, showCeiling, ceilingCells, pillars, siteMassing, site]);

  // ── Drive the floating label off the selection state.
  useEffect(() => {
    const marker = labelMarkerRef.current;
    if (!marker) return;
    if (!selectedPillar) {
      // Don't write `label = ''` — Map3D throws InvalidValueError for that.
      marker.style.display = 'none';
      return;
    }
    marker.position = {
      lat: selectedPillar.centre.lat,
      lng: selectedPillar.centre.lng,
      altitude: selectedPillar.heightM,
    };
    marker.label = buildPillarLabel(selectedPillar);
    marker.style.display = '';
  }, [selectedPillar]);

  // ── Camera follows the site when it changes (animated, keeps tile cache).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== 'ready') return;
    const altitude = siteResult.max_top_amsl_m ?? groundAmsl + 200;
    map.flyCameraTo({
      endCamera: {
        center: { lat: site.lat, lng: site.lon, altitude },
        tilt: 67,
        heading: map.heading ?? 0,
        range: Math.max(radiusM * 0.9, 600),
      },
      durationMillis: 1200,
    });
  }, [status, site, radiusM, groundAmsl, siteResult]);

  const handleResetCamera = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const altitude = siteResult.max_top_amsl_m ?? groundAmsl + 200;
    map.flyCameraTo({
      endCamera: {
        center: { lat: site.lat, lng: site.lon, altitude },
        tilt: 67,
        heading: 0,
        range: Math.max(radiusM * 0.9, 600),
      },
      durationMillis: 800,
    });
  }, [site, radiusM, groundAmsl, siteResult]);

  if (!googleKey) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center bg-muted/30 px-6 text-center"
      >
        <p className="max-w-sm text-sm text-muted-foreground">
          Photoreal needs a Google key with the <span className="font-medium">Map Tiles API</span>{' '}
          enabled (+ billing). Set{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>{' '}
          and redeploy with a fresh build (uncheck &ldquo;Use existing Build Cache&rdquo;).
        </p>
      </div>
    );
  }

  return (
    <div style={{ height }} className="relative bg-slate-200 dark:bg-slate-900">
      <div
        ref={hostRef}
        className="h-full w-full"
        style={dark ? { filter: 'brightness(0.78) saturate(0.85) contrast(1.05)' } : undefined}
      />

      {status === 'loading' && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/60 text-sm text-muted-foreground">
          Initialising Map3DElement…
        </div>
      )}

      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 px-6 text-center">
          <div className="max-w-md space-y-3">
            <p className="text-sm font-medium text-foreground">Photoreal failed to load</p>
            <p className="text-xs text-muted-foreground">{errorMessage ?? 'Unknown error.'}</p>
            <p className="text-xs text-muted-foreground">
              Confirm <span className="font-medium">Map Tiles API</span> is enabled on the key and
              billing is active. If the dev server was running before the loader was switched to
              <code className="mx-1 rounded bg-muted px-1 py-0.5 text-[10px]">v=alpha</code>, a
              hard reload (Cmd+Shift+R) is needed to pick up the new script.
            </p>
            <div className="flex justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setRetryNonce((n) => n + 1)}
                className="rounded-md border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-md border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
              >
                Hard reload
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute bottom-3 left-3 space-y-1 rounded-md bg-card/90 px-3 py-2 text-[11px] shadow backdrop-blur-sm">
        <div className="font-semibold text-foreground">
          Photoreal · Google 3D Tiles{' '}
          <span className="font-normal text-muted-foreground">
            ({pillars.length} structures
            {showCeiling ? ` · ${ceilingCells.length} ceiling cells` : ''})
          </span>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
          <LegendDot color={PILLAR_COLORS.noc} label="Issued NOC" />
          <LegendDot color={PILLAR_COLORS.noc_restricted} label="Restricted" />
          <LegendDot color={PILLAR_COLORS.appeal} label="Appeal" />
          <LegendDot color={PILLAR_COLORS.site} label="Your site" />
        </div>
        <div className="text-muted-foreground">
          Hover a building for its NOC + permitted top · imagery © Google
        </div>
      </div>

      {status === 'ready' && (
        <div className="absolute bottom-3 right-3 flex flex-col items-end gap-2">
          <div className="inline-flex rounded-md border bg-card/90 p-0.5 text-[11px] shadow backdrop-blur-sm">
            <ToggleButton active={showLabels} onClick={() => setShowLabels((v) => !v)}>
              Labels {showLabels ? 'on' : 'off'}
            </ToggleButton>
            <ToggleButton active={showCeiling} onClick={() => setShowCeiling((v) => !v)}>
              OLS ceiling {showCeiling ? 'on' : 'off'}
            </ToggleButton>
          </div>
          <button
            type="button"
            onClick={handleResetCamera}
            className="rounded-md border bg-card/90 px-3 py-1.5 text-xs font-medium shadow backdrop-blur-sm hover:bg-card"
          >
            Reset camera
          </button>
        </div>
      )}
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="size-2 rounded-sm" style={{ background: color }} aria-hidden />
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        'rounded-sm px-2.5 py-1 font-medium transition-colors ' +
        (active
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:bg-muted')
      }
    >
      {children}
    </button>
  );
}

/**
 * Single-line hover/click label for a structure. Map3D's `Marker3D.label`
 * is a flat string (no multi-line / no rich content), so we pack all the
 * NOC / appellate identifiers + heights into one `·`-separated row.
 */
function buildPillarLabel(p: PillarOverlay): string {
  const aboveGround = Math.max(0, p.topAmsl - p.groundAmsl);
  const heightStr = `${p.topAmsl.toFixed(1)} m AMSL · ~${aboveGround.toFixed(0)} m above ground`;

  let header: string;
  switch (p.kind) {
    case 'site':
      header = 'Buildable site massing';
      break;
    case 'appeal':
      header = p.nocId ? `Appellate case ${p.nocId}` : 'Appellate case';
      if (p.meetingDate) header += ` (${p.meetingDate})`;
      break;
    case 'noc_restricted':
      header = p.nocId ? `Restricted NOC ${p.nocId}` : 'Restricted NOC';
      break;
    case 'noc':
    default:
      header = p.nocId ? `Issued NOC ${p.nocId}` : 'Issued NOC';
      break;
  }

  return `${header} · ${heightStr}`;
}

/** Append an alpha channel to a #rrggbb hex. Map3D accepts #rrggbbaa. */
function withAlpha(hex: string, alpha: number): string {
  const clamped = Math.max(0, Math.min(1, alpha));
  const a = Math.round(clamped * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${a}`;
}
