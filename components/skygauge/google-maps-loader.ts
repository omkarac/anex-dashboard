/// <reference types="google.maps" />

/**
 * Shared Google Maps JS loader for Skygauge.
 *
 * Loads the Maps JavaScript API once and exposes helpers built on it — the 2D
 * map work uses Leaflet, but the JS API still powers Places Autocomplete
 * (search), the Elevation service (auto site-elevation), and the photoreal
 * mode (the `maps3d` web-component library). Using the JS API (browser context)
 * keeps everything working with an HTTP-referrer-restricted browser key.
 * Beta channel is required for `maps3d` — Places/Elevation behave identically.
 */

// Module-level read of the env var. In Next.js + Turbopack this is inlined
// into THIS module's chunk at build time. If the module ends up in a
// dynamically-imported (`ssr: false`) chunk, the inlining can silently fail
// (the value becomes `undefined` in that chunk despite Vercel having the var
// set). Callers in dynamic chunks should therefore pass the key explicitly
// via the `apiKey` parameter to `loadGoogleMaps` / `loadMap3DLibrary`; the
// env-var fallback is only used by callers in the main client bundle.
const GOOGLE_KEY_FROM_ENV = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

declare global {
  interface Window {
    google?: typeof google;
  }
}

let mapsPromise: Promise<typeof google> | null = null;

/** True when a Google key is configured (build-time inlined). */
export function hasGoogleKey(): boolean {
  return Boolean(GOOGLE_KEY_FROM_ENV);
}

/**
 * Load the Maps JS API (Places library) exactly once.
 *
 * @param apiKey  Override the env-var-derived key. Pass this from callers
 *                that live in dynamically-imported chunks where Turbopack
 *                may not have inlined `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.
 */
export function loadGoogleMaps(apiKey?: string): Promise<typeof google> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Maps unavailable during SSR'));
  }
  const key = apiKey ?? GOOGLE_KEY_FROM_ENV;
  if (!key) return Promise.reject(new Error('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY not set'));

  const existing = window.google;
  if (existing?.maps) return Promise.resolve(existing);
  if (mapsPromise) return mapsPromise;

  mapsPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    // v=alpha is required for the maps3d photoreal web components and is a
    // superset of beta; Places + Elevation behave identically. Nothing else
    // in the app depends on a pinned version.
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      key,
    )}&v=alpha&libraries=places&loading=async`;
    script.async = true;
    script.onload = () => {
      const loaded = window.google;
      if (loaded?.maps) resolve(loaded);
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
  const g = await loadGoogleMaps();
  const service = new g.maps.ElevationService();
  const { results } = await service.getElevationForLocations({ locations: [{ lat, lng: lon }] });
  const elev = results?.[0]?.elevation;
  return typeof elev === 'number' && Number.isFinite(elev) ? elev : null;
}

/**
 * Load the `maps3d` web-component library on top of the base loader. Returns
 * the namespaced module containing Map3DElement, Polygon3DElement, etc.
 * Needs the "Map Tiles API" enabled on the key + billing.
 *
 * `importLibrary` only resolves when the channel actually publishes the
 * library — calling it on a stale `window.google` (from a previous v=quarterly
 * load via HMR or a back-nav) can hang indefinitely. We race it against a
 * 12-second deadline so the UI flips to an explicit error rather than a
 * permanent spinner.
 *
 * @param apiKey  See `loadGoogleMaps` — required when this is called from a
 *                dynamically-imported chunk.
 */
const MAP3D_TIMEOUT_MS = 12_000;

let map3dPromise: Promise<unknown> | null = null;
export async function loadMap3DLibrary(apiKey?: string): Promise<unknown> {
  const g = await loadGoogleMaps(apiKey);
  if (!map3dPromise) {
    const importPromise = g.maps.importLibrary('maps3d');
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () =>
          reject(
            new Error(
              'maps3d library did not load within 12s — confirm the Map Tiles API is enabled, ' +
                'billing is active, and the Maps JS script was loaded with v=alpha. A hard ' +
                'reload may be needed if a previous session cached an older script.',
            ),
          ),
        MAP3D_TIMEOUT_MS,
      );
    });
    map3dPromise = Promise.race([importPromise, timeoutPromise]).then((lib) => {
      // Validate the shape — a successful resolution that's missing the constructor
      // points at a channel mismatch, not a runtime error.
      const candidate = lib as { Map3DElement?: unknown } | null;
      if (!candidate || typeof candidate.Map3DElement !== 'function') {
        throw new Error(
          'maps3d library loaded but is missing Map3DElement — the Maps JS script must be ' +
            'served from the alpha channel (v=alpha). A hard reload may be needed.',
        );
      }
      return lib;
    });
    // Reset the cache on rejection so a retry can re-fetch on the next render.
    map3dPromise.catch(() => {
      map3dPromise = null;
    });
  }
  return map3dPromise;
}
