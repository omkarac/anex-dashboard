'use client';

/**
 * Skygauge location search bar.
 *
 * Two input modes, picked automatically:
 *   1. Google Places Autocomplete — when NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is set.
 *      Restricted to the MMR bounding box and the IN region.
 *   2. Lat/lon paste — always available as a fallback, and works even when
 *      Places is configured (typing "19.076, 72.877" and pressing Enter parses
 *      directly, bypassing the autocomplete).
 *
 * We bind Google Autocomplete to a native <input> (not the shadcn wrapper)
 * because the Places widget needs a stable HTMLInputElement ref.
 */

import { useEffect, useRef, useState } from 'react';
import { MapPin, Search } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { LatLon } from '@/skygauge/api/ols/types';
import { hasGoogleKey, loadGoogleMaps } from './google-maps-loader';

// ─── MMR bounding box ───────────────────────────────────────────────────────
// Generous box around the Mumbai Metropolitan Region: Mira-Bhayandar/Thane in
// the north down to Panvel/Uran in the south, the coast across to the Karjat
// foothills in the east.
const MMR_BBOX = { north: 19.45, south: 18.85, east: 73.3, west: 72.75 } as const;

const HAS_KEY = hasGoogleKey();

/** Parse "lat, lon" (comma- or space-separated) into a coordinate, or null. */
function parseLatLon(raw: string): LatLon | null {
  const m = raw.trim().match(/^(-?\d{1,3}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = Number.parseFloat(m[1]);
  const lon = Number.parseFloat(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}

interface SkygaugeSearchProps {
  onSelect: (point: LatLon, label?: string) => void;
  className?: string;
}

export function SkygaugeSearch({ onSelect, className }: SkygaugeSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [placesReady, setPlacesReady] = useState(false);

  // Attach Google Places Autocomplete when a key is configured.
  useEffect(() => {
    if (!HAS_KEY || !inputRef.current) return;
    let cancelled = false;

    loadGoogleMaps()
      .then((google) => {
        if (cancelled || !inputRef.current) return;
        const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
          bounds: MMR_BBOX,
          strictBounds: true,
          fields: ['geometry', 'name', 'formatted_address'],
          componentRestrictions: { country: 'in' },
        });
        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          const loc = place.geometry?.location;
          if (!loc) return;
          const label = place.name ?? place.formatted_address;
          setValue(label ?? '');
          setError(null);
          onSelect({ lat: loc.lat(), lon: loc.lng() }, label);
        });
        setPlacesReady(true);
      })
      .catch(() => {
        // Stay in coordinate-paste mode; the input still works.
        if (!cancelled) setPlacesReady(false);
      });

    return () => {
      cancelled = true;
    };
  }, [onSelect]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const coords = parseLatLon(value);
    if (coords) {
      setError(null);
      onSelect(coords);
      return;
    }
    // Not coordinates: Places (if active) handles selection via its listener.
    if (!placesReady) {
      setError('Enter coordinates as "lat, lon" — e.g. 19.0760, 72.8777');
    }
  }

  const placeholder = placesReady
    ? 'Search a locality in MMR, or paste "lat, lon"'
    : 'Paste coordinates: 19.0760, 72.8777';

  return (
    <form
      onSubmit={handleSubmit}
      className={cn('shrink-0 border-b bg-card px-3 py-2.5', className)}
    >
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(null);
            }}
            placeholder={placeholder}
            aria-label="Search a location or paste coordinates"
            aria-invalid={error ? true : undefined}
            autoComplete="off"
            className={cn(
              'h-9 w-full min-w-0 rounded-lg border border-input bg-transparent pl-8 pr-2.5 py-1 text-sm transition-colors outline-none',
              'placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
              'aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30',
            )}
          />
        </div>
        <button
          type="submit"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <MapPin className="size-4" aria-hidden />
          Analyze
        </button>
      </div>
      {error ? (
        <p className="mt-1.5 text-[11px] font-medium text-destructive">{error}</p>
      ) : !placesReady ? (
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Google Places not configured — paste coordinates, or click anywhere on the map.
        </p>
      ) : null}
    </form>
  );
}
