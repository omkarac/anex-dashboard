'use client';

/**
 * Skygauge workspace — the client shell that wires the OLS engine to the map.
 *
 * Owns the shared interaction state (selected site, place label, manual site
 * elevation, neighborhood radius) and recomputes the binding OLS constraint
 * whenever any of them change. Also fetches the empirical band (nearby issued
 * NOCs) from /api/skygauge/neighborhood so the panel can show the
 * theoretical-vs-empirical delta. Composes: search bar (top) → map + result
 * panel (middle) → disclaimer (bottom).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { cn } from '@/lib/utils';
import { getGoogleElevation } from './google-maps-loader';
import { computeOLSLimit } from '@/skygauge/api/ols/engine';
import type { LatLon } from '@/skygauge/api/ols/types';
import { buildEmpiricalBand } from '@/skygauge/api/empirical/band';
import type { NearbyAppeal, NearbyNoc, NeighborhoodStats } from '@/skygauge/api/empirical/types';

import { SkygaugeDisclaimer } from './skygauge-disclaimer';
import { SkygaugeMap } from './skygauge-map';
import { SkygaugePhotoreal } from './skygauge-photoreal';
import {
  SkygaugeResultPanel,
  type ElevationSource,
  type EmpiricalStatus,
} from './skygauge-result-panel';
import { SkygaugeScene } from './skygauge-scene';
import { SkygaugeSearch } from './skygauge-search';
import { SkygaugeStreetView } from './skygauge-street-view';

const DEFAULT_RADIUS_M = 1000;

type SkygaugeView = '2d' | '3d' | 'photoreal' | 'street';

const VIEW_LABELS: Record<SkygaugeView, string> = {
  '2d': '2D map',
  '3d': '3D scene',
  photoreal: 'Photoreal',
  street: 'Street view',
};

export function SkygaugeWorkspace() {
  const [site, setSite] = useState<LatLon | null>(null);
  const [label, setLabel] = useState<string | undefined>(undefined);
  const [elevationStr, setElevationStr] = useState('');
  const [elevationSource, setElevationSource] = useState<ElevationSource>(null);
  const elevationSourceRef = useRef<ElevationSource>(null);
  const [radiusM, setRadiusM] = useState(DEFAULT_RADIUS_M);

  const [empiricalStatus, setEmpiricalStatus] = useState<EmpiricalStatus>('idle');
  const [stats, setStats] = useState<NeighborhoodStats | null>(null);
  const [appeals, setAppeals] = useState<NearbyAppeal[]>([]);
  const [nocs, setNocs] = useState<NearbyNoc[]>([]);
  const [view, setView] = useState<SkygaugeView>('2d');

  const elevation_m = useMemo(() => {
    const parsed = Number.parseFloat(elevationStr);
    return Number.isFinite(parsed) ? parsed : undefined;
  }, [elevationStr]);

  const result = useMemo(() => {
    if (!site) return null;
    return computeOLSLimit({ lat: site.lat, lon: site.lon, elevation_m });
  }, [site, elevation_m]);

  // Fetch the empirical neighborhood band whenever the site or radius changes.
  // 'loading' is set by the event handlers below (selecting a site / changing
  // radius), so the effect only writes state from its async callbacks.
  useEffect(() => {
    if (!site) return;
    const controller = new AbortController();
    const params = new URLSearchParams({
      lat: String(site.lat),
      lon: String(site.lon),
      radius: String(radiusM),
    });
    fetch(`/api/skygauge/neighborhood?${params.toString()}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{
          stats: NeighborhoodStats | null;
          appeals?: NearbyAppeal[];
          nocs?: NearbyNoc[];
        }>;
      })
      .then((json) => {
        setStats(json.stats ?? null);
        setAppeals(json.appeals ?? []);
        setNocs(json.nocs ?? []);
        setEmpiricalStatus('ready');
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setStats(null);
        setAppeals([]);
        setNocs([]);
        setEmpiricalStatus('error');
      });
    return () => controller.abort();
  }, [site, radiusM]);

  // Auto-fetch ground elevation from Google whenever the site changes. Skipped
  // if the user has manually overridden it for this site; clearing + the
  // 'loading' flag are set in handleSelect (event handler), so the effect only
  // writes state from its async callback.
  useEffect(() => {
    if (!site) return;
    let cancelled = false;
    getGoogleElevation(site.lat, site.lon)
      .then((elev) => {
        if (cancelled || elev === null || elevationSourceRef.current === 'manual') return;
        elevationSourceRef.current = 'google';
        setElevationSource('google');
        setElevationStr(elev.toFixed(1));
      })
      .catch(() => {
        if (cancelled || elevationSourceRef.current === 'manual') return;
        elevationSourceRef.current = null;
        setElevationSource(null);
      });
    return () => {
      cancelled = true;
    };
  }, [site]);

  // The delta uses the theoretical AMSL ceiling, which is independent of the
  // manual elevation — so deriving the band here (not in the fetch) avoids refetching.
  const band = useMemo(() => {
    if (!stats) return null;
    return buildEmpiricalBand(stats, result?.max_top_amsl_m ?? null);
  }, [stats, result]);

  const handleSelect = useCallback((point: LatLon, placeLabel?: string) => {
    setSite(point);
    setLabel(placeLabel);
    setEmpiricalStatus('loading'); // a fetch is about to fire in the effect
    // Reset elevation for the new site; the effect will auto-fill from Google.
    setElevationStr('');
    elevationSourceRef.current = 'loading';
    setElevationSource('loading');
  }, []);

  const handleElevationChange = useCallback((value: string) => {
    elevationSourceRef.current = 'manual';
    setElevationSource('manual');
    setElevationStr(value);
  }, []);

  const handleRadiusChange = useCallback(
    (next: number) => {
      setRadiusM(next);
      if (site) setEmpiricalStatus('loading');
    },
    [site],
  );

  return (
    <div className="flex h-full flex-col">
      <SkygaugeSearch onSelect={handleSelect} />

      <div className="relative flex-1 overflow-hidden">
        {view === '2d' ? (
          <SkygaugeMap height="100%" selectedPoint={site} onSelectPoint={handleSelect} />
        ) : !site ? (
          <div className="flex h-full items-center justify-center bg-muted/30 px-6 text-center">
            <p className="text-sm text-muted-foreground">
              Select a site — search above, or switch to the 2D map and click a point — to open{' '}
              {VIEW_LABELS[view]}.
            </p>
          </div>
        ) : view === '3d' ? (
          <SkygaugeScene
            site={site}
            result={result}
            elevationM={elevation_m}
            radiusM={radiusM}
            nocs={nocs}
            appeals={appeals}
            height="100%"
          />
        ) : view === 'photoreal' ? (
          <SkygaugePhotoreal
            site={site}
            elevationM={elevation_m}
            radiusM={radiusM}
            nocs={nocs}
            appeals={appeals}
            height="100%"
          />
        ) : (
          <SkygaugeStreetView site={site} result={result} height="100%" />
        )}

        {/* View toggle — top center, clear of the panel (left) and layer toggles (right) */}
        <div className="pointer-events-none absolute inset-x-0 top-3 z-[1000] flex justify-center">
          <div className="pointer-events-auto inline-flex rounded-lg border bg-card/90 p-0.5 shadow-sm backdrop-blur-sm">
            {(['2d', '3d', 'photoreal', 'street'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                aria-pressed={view === v}
                className={cn(
                  'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                  view === v
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted',
                )}
              >
                {VIEW_LABELS[v]}
              </button>
            ))}
          </div>
        </div>

        {/* Result panel — overlays the top-left in both views */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-[1000] flex p-3">
          <div className="pointer-events-auto w-[340px] max-w-[calc(100vw-1.5rem)]">
            <SkygaugeResultPanel
              site={site}
              label={label}
              result={result}
              elevationStr={elevationStr}
              elevationSource={elevationSource}
              onElevationChange={handleElevationChange}
              empirical={{
                status: empiricalStatus,
                band,
                appeals,
                radiusM,
                onRadiusChange: handleRadiusChange,
              }}
            />
          </div>
        </div>
      </div>

      <SkygaugeDisclaimer />
    </div>
  );
}
