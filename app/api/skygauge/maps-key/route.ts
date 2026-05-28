/**
 * Skygauge Google Maps API key — runtime delivery endpoint.
 *
 * We read the key SERVER-SIDE here instead of relying on `NEXT_PUBLIC_*`
 * inlining at build time. In Next.js 16 + Turbopack, `NEXT_PUBLIC_*` env vars
 * are sometimes correctly inlined into the main client bundle but resolve to
 * `undefined` inside a chunk split off via `dynamic(() => import(...),
 * { ssr: false })` — which is exactly how Photoreal is loaded. The deployed
 * build can have the env var set and still produce a chunk where the env
 * read returns nothing.
 *
 * Server-side `process.env` is evaluated at REQUEST time on Vercel and is
 * not subject to any build-time inlining; whatever's in the project's
 * environment variables is what we see here. The client fetches this route
 * on mount, so we sidestep the inlining issue entirely.
 *
 * The key itself isn't secret — it's a browser key restricted by HTTP
 * referrer in the Cloud Console. Exposing it to the client is by design;
 * we just need a reliable path for the client to receive it.
 *
 * Admin-gated to match the rest of the Skygauge surface. The hard-coded
 * fallback at the bottom is the demo safety net; remove it once the Vercel
 * env var is confirmed propagating.
 */

import { NextResponse } from 'next/server';

import { requireAdmin } from '@/lib/rbac';

// Last-resort fallback for the demo. Browser key (already public via
// inlining when the env path works) with HTTP-referrer restrictions in
// Cloud Console. Replace / delete once the Vercel env var is verified.
const DEMO_FALLBACK_KEY = 'AIzaSyAbD1APqOaGu-W3ZWYCqS3lEVldKeWiCuo';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Match the Skygauge page's gating. requireAdmin throws on unauthorized.
  await requireAdmin();

  const fromEnv =
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    '';

  const key = fromEnv || DEMO_FALLBACK_KEY;
  const source: 'env' | 'fallback' = fromEnv ? 'env' : 'fallback';

  return NextResponse.json(
    {
      key,
      source,
      // Small surface to diagnose env-var propagation without leaking the
      // key. Server-side reads NEVER touch build-time inlining.
      diagnostics: {
        hasPublicEnv: Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY),
        hasPrivateEnv: Boolean(process.env.GOOGLE_MAPS_API_KEY),
        envKeyLength: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.length ?? 0,
      },
    },
    {
      headers: {
        // Per-user cache (the response includes a key — don't share between
        // users). 5-minute browser cache so we don't refetch on every render.
        'Cache-Control': 'private, max-age=300',
      },
    },
  );
}
