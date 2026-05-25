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

import { useCallback, useEffect, useMemo, useState } from 'react';

import { computeOLSLimit } from '@/skygauge/api/ols/engine';
import type { LatLon } from '@/skygauge/api/ols/types';
import { buildEmpiricalBand } from '@/skygauge/api/empirical/band';
import type { NeighborhoodStats } from '@/skygauge/api/empirical/types';

import { SkygaugeDisclaimer } from './skygauge-disclaimer';
import { SkygaugeMap } from './skygauge-map';
import { SkygaugeResultPanel, type EmpiricalStatus } from './skygauge-result-panel';
import { SkygaugeSearch } from './skygauge-search';

const DEFAULT_RADIUS_M = 1000;

export function SkygaugeWorkspace() {
  const [site, setSite] = useState<LatLon | null>(null);
  const [label, setLabel] = useState<string | undefined>(undefined);
  const [elevationStr, setElevationStr] = useState('');
  const [radiusM, setRadiusM] = useState(DEFAULT_RADIUS_M);

  const [empiricalStatus, setEmpiricalStatus] = useState<EmpiricalStatus>('idle');
  const [stats, setStats] = useState<NeighborhoodStats | null>(null);

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
        return res.json() as Promise<{ stats: NeighborhoodStats | null }>;
      })
      .then((json) => {
        setStats(json.stats ?? null);
        setEmpiricalStatus('ready');
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setStats(null);
        setEmpiricalStatus('error');
      });
    return () => controller.abort();
  }, [site, radiusM]);

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
        <SkygaugeMap height="100%" selectedPoint={site} onSelectPoint={handleSelect} />

        {/* Result panel — overlays the map's top-left; layer toggles live top-right */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-[1000] flex p-3">
          <div className="pointer-events-auto w-[340px] max-w-[calc(100vw-1.5rem)]">
            <SkygaugeResultPanel
              site={site}
              label={label}
              result={result}
              elevationStr={elevationStr}
              onElevationChange={setElevationStr}
              empirical={{
                status: empiricalStatus,
                band,
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
