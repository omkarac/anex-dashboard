/**
 * Shared Google Maps JS loader for Skygauge.
 *
 * Loads the Maps JavaScript API once (with the Places library) and exposes
 * helpers that build on it — Places Autocomplete (search bar) and the Elevation
 * service (auto site-elevation). Using the JS API (browser context) means it
 * keeps working with an HTTP-referrer-restricted browser key, unlike the
 * server-side web services.
 *
 * Minimal local typings cover only what we touch — avoids an @types/google.maps
 * dependency.
 */

const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

// ─── Minimal typings ────────────────────────────────────────────────────────

interface GPlaceGeometry {
  location?: { lat(): number; lng(): number };
}
export interface GPlace {
  geometry?: GPlaceGeometry;
  name?: string;
  formatted_address?: string;
}
export interface GAutocomplete {
  addListener(event: 'place_changed', handler: () => void): void;
  getPlace(): GPlace;
}
export interface GAutocompleteOptions {
  bounds?: { north: number; south: number; east: number; west: number };
  strictBounds?: boolean;
  fields?: readonly string[];
  componentRestrictions?: { country: string | string[] };
}
interface GElevationResult {
  elevation: number;
}
interface GElevationResponse {
  results: GElevationResult[];
}
interface GElevationService {
  getElevationForLocations(request: {
    locations: { lat: number; lng: number }[];
  }): Promise<GElevationResponse>;
}
export interface GoogleMapsApi {
  maps: {
    places: {
      Autocomplete: new (input: HTMLInputElement, opts?: GAutocompleteOptions) => GAutocomplete;
    };
    ElevationService: new () => GElevationService;
  };
}

declare global {
  interface Window {
    google?: GoogleMapsApi;
  }
}

let mapsPromise: Promise<GoogleMapsApi> | null = null;

/** True when a Google key is configured (build-time inlined). */
export function hasGoogleKey(): boolean {
  return Boolean(GOOGLE_KEY);
}

/** Load the Maps JS API (Places library) exactly once. Rejects without a key. */
export function loadGoogleMaps(): Promise<GoogleMapsApi> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Maps unavailable during SSR'));
  }
  if (!GOOGLE_KEY) return Promise.reject(new Error('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY not set'));
  if (window.google?.maps) return Promise.resolve(window.google);
  if (mapsPromise) return mapsPromise;

  mapsPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      GOOGLE_KEY,
    )}&libraries=places&loading=async`;
    script.async = true;
    script.onload = () => {
      if (window.google?.maps) resolve(window.google);
      else reject(new Error('Google Maps failed to initialise after load'));
    };
    script.onerror = () => reject(new Error('Google Maps script failed to load'));
    document.head.appendChild(script);
  });
  return mapsPromise;
}

/**
 * Ground elevation (metres AMSL) at a coordinate via the Elevation service, or
 * null if unavailable. Needs the "Elevation API" enabled on the key.
 */
export async function getGoogleElevation(lat: number, lon: number): Promise<number | null> {
  const google = await loadGoogleMaps();
  const service = new google.maps.ElevationService();
  const { results } = await service.getElevationForLocations({ locations: [{ lat, lng: lon }] });
  const elev = results?.[0]?.elevation;
  return typeof elev === 'number' && Number.isFinite(elev) ? elev : null;
}
