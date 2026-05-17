'use client';

import { useEffect } from 'react';
import { useTheme } from 'next-themes';
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import type { LatLngExpression, LatLngBoundsExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MICRO_MARKET_COORDS } from '@/lib/data/micro-market-coords';
import { MICRO_MARKETS } from '@/lib/enums/micro-markets';

// ─── Types ────────────────────────────────────────────────────────────────────

type HeatPoint = [number, number, number];

export interface LocationMapProps {
  appetiteMarkets: string[];
  sharedMarkets?: string[];
  interestedMarkets?: string[];
}

// ─── Tile URLs ────────────────────────────────────────────────────────────────

const TILES = {
  dark:  'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
} as const;

// ─── Heat layer config ────────────────────────────────────────────────────────

const HEAT_CONFIG = [
  {
    gradient: {
      0.0: 'transparent',
      0.3: 'rgba(239,68,68,0.25)',
      0.6: 'rgba(220,38,38,0.65)',
      1.0: 'rgba(185,28,28,0.92)',
    },
  },
  {
    gradient: {
      0.0: 'transparent',
      0.3: 'rgba(250,204,21,0.25)',
      0.6: 'rgba(234,179,8,0.65)',
      1.0: 'rgba(161,98,7,0.92)',
    },
  },
  {
    gradient: {
      0.0: 'transparent',
      0.3: 'rgba(74,222,128,0.25)',
      0.6: 'rgba(34,197,94,0.65)',
      1.0: 'rgba(22,101,52,0.92)',
    },
  },
] as const;

// ─── Multi heat layer ─────────────────────────────────────────────────────────

function MultiHeatLayer({
  layers,
}: {
  layers: { points: HeatPoint[]; gradient: Record<number, string> }[];
}) {
  const map = useMap();

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const L = require('leaflet');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('leaflet.heat');

    const added = layers
      .filter((l) => l.points.length > 0)
      .map((l) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (L as any)
          .heatLayer(l.points, {
            radius: 40,
            blur: 24,
            maxZoom: 14,
            gradient: l.gradient,
          })
          .addTo(map)
      );

    return () => { added.forEach((layer) => map.removeLayer(layer)); };
  }, [map, layers]);

  return null;
}

// ─── Fly-in animation ─────────────────────────────────────────────────────────

function FlyInAnimation({ allPoints }: { allPoints: [number, number][] }) {
  const map = useMap();

  useEffect(() => {
    if (allPoints.length === 0) return;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const L = require('leaflet');
    const bounds = L.latLngBounds(allPoints);

    // Short delay so tiles render before animating
    const timer = setTimeout(() => {
      map.flyToBounds(bounds as LatLngBoundsExpression, {
        padding: [48, 48],
        duration: 1.8,
        easeLinearity: 0.12,
      });
    }, 250);

    return () => clearTimeout(timer);
  // Re-fly whenever the set of points changes (e.g. switching developer preset)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, JSON.stringify(allPoints)]);

  return null;
}

// ─── Dot marker priority ──────────────────────────────────────────────────────

function markerStyle(
  value: string,
  appetite: Set<string>,
  shared: Set<string>,
  interested: Set<string>
): { fill: string; stroke: string; radius: number } | null {
  if (interested.has(value)) return { fill: '#4ade80', stroke: '#16a34a', radius: 6 };
  if (shared.has(value))     return { fill: '#fde047', stroke: '#ca8a04', radius: 5 };
  if (appetite.has(value))   return { fill: '#f87171', stroke: '#dc2626', radius: 4 };
  return null;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function LocationMapInner({
  appetiteMarkets,
  sharedMarkets = [],
  interestedMarkets = [],
}: LocationMapProps) {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === 'dark';

  const toPoints = (markets: string[]): HeatPoint[] =>
    markets
      .map((v) => MICRO_MARKET_COORDS[v])
      .filter(Boolean)
      .map(([lat, lng]) => [lat, lng, 1.0]);

  const heatLayers = [
    { points: toPoints(appetiteMarkets),   gradient: HEAT_CONFIG[0].gradient },
    { points: toPoints(sharedMarkets),     gradient: HEAT_CONFIG[1].gradient },
    { points: toPoints(interestedMarkets), gradient: HEAT_CONFIG[2].gradient },
  ];

  const allPoints: [number, number][] = [
    ...appetiteMarkets,
    ...sharedMarkets,
    ...interestedMarkets,
  ]
    .map((v) => MICRO_MARKET_COORDS[v])
    .filter(Boolean)
    .map(([lat, lng]) => [lat, lng]);

  const appetiteSet   = new Set(appetiteMarkets);
  const sharedSet     = new Set(sharedMarkets);
  const interestedSet = new Set(interestedMarkets);

  return (
    <div className="relative">
      <MapContainer
        center={[19.2, 72.9] as LatLngExpression}
        zoom={9}
        scrollWheelZoom
        zoomControl={false}
        attributionControl={false}
        style={{ height: '280px', width: '100%', borderRadius: '0.5rem' }}
      >
        <TileLayer
          key={dark ? 'dark' : 'light'}
          url={dark ? TILES.dark : TILES.light}
          subdomains="abcd"
          maxZoom={19}
        />

        <MultiHeatLayer layers={heatLayers} />
        <FlyInAnimation allPoints={allPoints} />

        {MICRO_MARKETS.filter((m) => MICRO_MARKET_COORDS[m.value]).map((m) => {
          const style = markerStyle(m.value, appetiteSet, sharedSet, interestedSet);
          if (!style) {
            return (
              <CircleMarker
                key={m.value}
                center={MICRO_MARKET_COORDS[m.value] as LatLngExpression}
                radius={1.5}
                pathOptions={{
                  color: dark ? '#64748b' : '#94a3b8',
                  fillColor: dark ? '#475569' : '#cbd5e1',
                  fillOpacity: 0.3,
                  weight: 0,
                }}
              />
            );
          }
          return (
            <CircleMarker
              key={m.value}
              center={MICRO_MARKET_COORDS[m.value] as LatLngExpression}
              radius={style.radius}
              pathOptions={{
                color: style.stroke,
                fillColor: style.fill,
                fillOpacity: 0.9,
                weight: 1.5,
              }}
            >
              <Tooltip direction="top" offset={[0, -8]} opacity={0.95}>
                <span className="text-xs font-medium">{m.label}</span>
              </Tooltip>
            </CircleMarker>
          );
        })}

      </MapContainer>

      {/* Legend */}
      <div
        className="absolute bottom-3 left-3 z-[1000] flex flex-col gap-1 rounded-md px-2.5 py-2"
        style={{
          background: dark ? 'rgba(0,0,0,0.70)' : 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(6px)',
          border: dark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
        }}
      >
        {[
          { color: '#f87171', label: 'Appetite' },
          { color: '#fde047', label: 'Shared' },
          { color: '#4ade80', label: 'Interested' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
            <span
              className="text-[10px] leading-none"
              style={{ color: dark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.65)' }}
            >
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
