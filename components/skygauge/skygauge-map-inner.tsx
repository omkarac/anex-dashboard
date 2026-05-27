'use client';

/**
 * Skygauge 2D map — Leaflet + Carto tiles (free, open source).
 *
 * Theme-aware Carto basemap, with the OLS overlays drawn declaratively:
 * ARP markers, runway centerlines (anchored on the canonical true_bearing —
 * AIP threshold coordinates are precise to ±10 m which compounds to ~13°
 * bearing error over 3 km), and approach/take-off footprints. Controlled
 * selected point (search or click) with fly-to when it lands off-screen.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import {
  CircleMarker,
  MapContainer,
  Polygon,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
  ZoomControl,
} from 'react-leaflet';
import type { LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { MMR_AIRPORTS } from '@/skygauge/api/ols/airports';
import { destinationPoint } from '@/skygauge/api/ols/geo';
import { mmrFootprints } from '@/skygauge/api/ols/footprints';
import type { LatLon } from '@/skygauge/api/ols/types';

// ─── Tiles ────────────────────────────────────────────────────────────────────

const TILES = {
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
} as const;

const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toLatLng({ lat, lon }: LatLon): LatLngExpression {
  return [lat, lon];
}

interface ClickProbeProps {
  onClick: (point: LatLon) => void;
}

function ClickProbe({ onClick }: ClickProbeProps) {
  useMapEvents({
    click(e) {
      onClick({ lat: e.latlng.lat, lon: e.latlng.lng });
    },
  });
  return null;
}

interface RecenterOnSelectProps {
  point: LatLon | null;
}

/**
 * Pan to the selected point when it changes — but only if it's currently
 * off-screen. A map click inside the viewport shouldn't jolt the view; a
 * search result far away should fly into frame.
 */
function RecenterOnSelect({ point }: RecenterOnSelectProps) {
  const map = useMap();
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    if (!point) return;
    const key = `${point.lat},${point.lon}`;
    if (lastKey.current === key) return;
    lastKey.current = key;

    const latlng: LatLngExpression = [point.lat, point.lon];
    if (!map.getBounds().contains(latlng)) {
      map.flyTo(latlng, Math.max(map.getZoom(), 14), { duration: 0.8 });
    }
  }, [point, map]);

  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface SkygaugeMapInnerProps {
  /** Optional initial center; defaults to roughly the MMR centroid. */
  initialCenter?: LatLngExpression;
  initialZoom?: number;
  height?: string;
  /** Controlled selected point. When provided, the map mirrors this value. */
  selectedPoint?: LatLon | null;
  /** Called on map click (and used as the controlled-update channel). */
  onSelectPoint?: (point: LatLon) => void;
}

export default function SkygaugeMapInner({
  initialCenter = [19.07, 72.92] as LatLngExpression,
  initialZoom = 11,
  height = 'calc(100vh - 4rem)',
  selectedPoint,
  onSelectPoint,
}: SkygaugeMapInnerProps) {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === 'dark';

  const [showApproach, setShowApproach] = useState(true);
  const [showTakeoff, setShowTakeoff] = useState(true);
  // Fall back to internal state when used uncontrolled (no onSelectPoint).
  const [internalPoint, setInternalPoint] = useState<LatLon | null>(null);
  const point = selectedPoint !== undefined ? selectedPoint : internalPoint;

  const handleSelect = useCallback(
    (p: LatLon) => {
      if (onSelectPoint) onSelectPoint(p);
      else setInternalPoint(p);
    },
    [onSelectPoint],
  );

  // Compute footprints + runway centerlines once. Pure functions of the
  // (currently constant) airport configs — fine to memoise without deps.
  const footprints = useMemo(() => mmrFootprints(), []);
  const runwayLines = useMemo(() => {
    const lines: { airport: string; designator: string; from: LatLon; to: LatLon }[] = [];
    for (const airport of MMR_AIRPORTS) {
      for (const r of airport.runways) {
        // Use the published true_bearing as the canonical axis (raw threshold
        // coordinates can disagree by several degrees due to AIP imprecision).
        const a = { lat: r.threshold_a.lat, lon: r.threshold_a.lon };
        const b = destinationPoint(a, r.true_bearing, r.length_m);
        lines.push({ airport: airport.code, designator: r.designator, from: a, to: b });
      }
    }
    return lines;
  }, []);

  const approachFootprints = footprints.filter((f) => f.surface === 'approach');
  const takeoffFootprints = footprints.filter((f) => f.surface === 'takeoff_climb');

  return (
    <div className="relative" style={{ height }}>
      <MapContainer
        center={initialCenter}
        zoom={initialZoom}
        scrollWheelZoom
        zoomControl={false}
        style={{ height: '100%', width: '100%' }}
      >
        {/* Bottom-right — clear of the left result panel + centre view toggle */}
        <ZoomControl position="bottomright" />

        <TileLayer
          key={dark ? 'dark' : 'light'}
          url={dark ? TILES.dark : TILES.light}
          attribution={TILE_ATTRIBUTION}
          subdomains="abcd"
          maxZoom={19}
        />

        <ClickProbe onClick={handleSelect} />
        <RecenterOnSelect point={point} />

        {/* Take-off trapezoids — drawn first so approach paints on top */}
        {showTakeoff &&
          takeoffFootprints.map((f, i) => (
            <Polygon
              key={`takeoff-${f.airport_code}-${f.runway_designator}-${f.threshold_name}-${i}`}
              positions={f.polygon.map(toLatLng)}
              pathOptions={{
                color: '#7c3aed',
                weight: 1,
                opacity: 0.6,
                dashArray: '4 4',
                fillColor: '#a78bfa',
                fillOpacity: 0.10,
              }}
            >
              <Tooltip direction="top" sticky>
                <div className="text-xs">
                  <div className="font-medium">
                    {f.airport_code} take-off past {f.threshold_name}
                  </div>
                  <div className="text-muted-foreground">
                    {f.runway_designator} · {(f.length_m / 1000).toFixed(1)} km · 2 % slope
                  </div>
                </div>
              </Tooltip>
            </Polygon>
          ))}

        {/* Approach trapezoids */}
        {showApproach &&
          approachFootprints.map((f, i) => (
            <Polygon
              key={`approach-${f.airport_code}-${f.runway_designator}-${f.threshold_name}-${i}`}
              positions={f.polygon.map(toLatLng)}
              pathOptions={{
                color: '#185fa5',
                weight: 1.2,
                opacity: 0.7,
                fillColor: '#378add',
                fillOpacity: 0.18,
              }}
            >
              <Tooltip direction="top" sticky>
                <div className="text-xs">
                  <div className="font-medium">
                    {f.airport_code} approach to {f.threshold_name}
                  </div>
                  <div className="text-muted-foreground">
                    {f.runway_designator} · {(f.length_m / 1000).toFixed(1)} km · 2 % / 2.5 % / flat
                  </div>
                </div>
              </Tooltip>
            </Polygon>
          ))}

        {/* Runway centerlines */}
        {runwayLines.map((line) => (
          <Polyline
            key={`rwy-${line.airport}-${line.designator}`}
            positions={[toLatLng(line.from), toLatLng(line.to)]}
            pathOptions={{
              color: dark ? '#fef3c7' : '#1f2937',
              weight: 3,
              opacity: 0.9,
            }}
          >
            <Tooltip direction="top">
              <span className="text-xs font-medium">
                {line.airport} {line.designator}
              </span>
            </Tooltip>
          </Polyline>
        ))}

        {/* ARP markers */}
        {MMR_AIRPORTS.map((airport) => (
          <CircleMarker
            key={airport.code}
            center={toLatLng(airport.arp)}
            radius={6}
            pathOptions={{
              color: '#A32D2D',
              fillColor: '#E24B4A',
              fillOpacity: 0.95,
              weight: 2,
            }}
          >
            <Tooltip direction="top" offset={[0, -6]} opacity={0.95}>
              <div className="text-xs">
                <div className="font-medium">{airport.code}</div>
                <div className="text-muted-foreground">{airport.name}</div>
                <div>elev. {airport.elevation_m.toFixed(1)} m AMSL</div>
              </div>
            </Tooltip>
          </CircleMarker>
        ))}

        {/* Selected-site indicator */}
        {point && (
          <CircleMarker
            center={toLatLng(point)}
            radius={6}
            pathOptions={{
              color: '#16a34a',
              fillColor: '#4ade80',
              fillOpacity: 0.9,
              weight: 2,
            }}
          >
            <Tooltip direction="top" offset={[0, -6]}>
              <div className="text-xs font-mono">
                {point.lat.toFixed(5)}, {point.lon.toFixed(5)}
              </div>
            </Tooltip>
          </CircleMarker>
        )}
      </MapContainer>

      {/* OLS layer toggles — top-right (clear of the left result panel + centre view toggle) */}
      <div
        className="absolute top-3 right-3 z-[1000] rounded-md px-3 py-2 text-xs"
        style={{
          background: dark ? 'rgba(15,15,15,0.85)' : 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(8px)',
          border: dark ? '1px solid rgba(255,255,255,0.10)' : '1px solid rgba(0,0,0,0.08)',
          color: dark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.80)',
        }}
      >
        <div className="font-medium mb-2 text-[11px] uppercase tracking-wide opacity-70">
          OLS surfaces
        </div>
        <label className="flex items-center gap-2 cursor-pointer py-0.5">
          <input
            type="checkbox"
            checked={showApproach}
            onChange={(e) => setShowApproach(e.target.checked)}
          />
          <span
            className="inline-block h-2.5 w-3 rounded-sm"
            style={{ background: '#378add', opacity: 0.7 }}
          />
          <span>Approach</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer py-0.5">
          <input
            type="checkbox"
            checked={showTakeoff}
            onChange={(e) => setShowTakeoff(e.target.checked)}
          />
          <span
            className="inline-block h-2.5 w-3 rounded-sm border border-dashed"
            style={{ background: '#a78bfa', opacity: 0.6, borderColor: '#7c3aed' }}
          />
          <span>Take-off</span>
        </label>
      </div>
    </div>
  );
}
