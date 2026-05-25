'use client';

/**
 * Skygauge Street View companion.
 *
 * Ground-level reality check for the selected site via the Google Maps Embed API
 * (free, no JS SDK). The panorama is aimed toward the binding airport so you look
 * along the constraint direction. Street View can't host our 3D OLS overlay — it's
 * a complementary "what's actually there" view. Falls back to a hint when no key
 * is configured.
 */

import { useMemo } from 'react';

import { MMR_AIRPORTS } from '@/skygauge/api/ols/airports';
import { initialBearingDeg } from '@/skygauge/api/ols/geo';
import type { LatLon, OLSResult } from '@/skygauge/api/ols/types';

const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

interface SkygaugeStreetViewProps {
  site: LatLon;
  result: OLSResult | null;
  height?: string;
}

export function SkygaugeStreetView({ site, result, height = '100%' }: SkygaugeStreetViewProps) {
  const binding = result?.binding ?? null;
  const bindingAirport = binding
    ? (MMR_AIRPORTS.find((a) => a.code === binding.airport_code) ?? null)
    : null;

  const heading = useMemo(
    () => (bindingAirport ? Math.round(initialBearingDeg(site, bindingAirport.arp)) : 0),
    [site, bindingAirport],
  );

  if (!GOOGLE_KEY) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center bg-muted/30 px-6 text-center"
      >
        <p className="max-w-sm text-sm text-muted-foreground">
          Street View needs a Google key. Set{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>{' '}
          with the <span className="font-medium">Maps Embed API</span> enabled, then reload.
        </p>
      </div>
    );
  }

  const params = new URLSearchParams({
    key: GOOGLE_KEY,
    location: `${site.lat},${site.lon}`,
    heading: String(heading),
    pitch: '8',
    fov: '90',
  });
  const src = `https://www.google.com/maps/embed/v1/streetview?${params.toString()}`;

  const capLabel =
    result?.max_top_amsl_m != null
      ? `${result.max_top_amsl_m.toFixed(0)} m AMSL`
      : 'unconstrained';

  return (
    <div style={{ height }} className="relative">
      <iframe
        key={src}
        title="Street View of the selected site"
        src={src}
        className="h-full w-full border-0"
        loading="lazy"
        allowFullScreen
        referrerPolicy="no-referrer-when-downgrade"
      />
      <div className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-card/90 px-3 py-2 text-[11px] shadow backdrop-blur-sm">
        <div className="font-medium text-foreground">
          Ground view · {site.lat.toFixed(4)}, {site.lon.toFixed(4)}
          {bindingAirport && (
            <span className="font-normal text-muted-foreground">
              {' '}
              · facing {bindingAirport.code} ({heading}°)
            </span>
          )}
        </div>
        <div className="text-muted-foreground">Drag to look around · OLS cap here: {capLabel}</div>
      </div>
    </div>
  );
}
