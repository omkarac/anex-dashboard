'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';
import type SkygaugePhotorealInner from './skygauge-photoreal-inner';
import { SceneErrorBoundary } from './scene-error-boundary';

/**
 * Photoreal wrapper.
 *
 * The Google Maps key lookup is layered for reliability:
 *
 *   1. Try `process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (build-time inlined).
 *      Works when Next.js + Turbopack inlines the var correctly into the
 *      main client bundle.
 *
 *   2. If that returned undefined / empty (which happens reproducibly when
 *      the inlining doesn't reach the dynamic chunk this wrapper lazy-loads),
 *      hit `/api/skygauge/maps-key`. The server reads `process.env` at
 *      REQUEST time — not subject to any build-time inlining — and returns
 *      the key directly.
 *
 *   3. That same route has a hard-coded last-resort fallback so a fresh
 *      Vercel deploy where the env var hasn't propagated yet still works
 *      (see the route's comment for context).
 *
 * The inner component never reads `process.env` itself; it receives the
 * resolved key as a `googleKey` prop.
 */
const BUILD_TIME_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

const SkygaugePhotorealInnerDynamic = dynamic(() => import('./skygauge-photoreal-inner'), {
  ssr: false,
  loading: () => <LoadingFallback />,
});

type SkygaugePhotorealProps = Omit<
  ComponentProps<typeof SkygaugePhotorealInner>,
  'googleKey'
>;

export function SkygaugePhotoreal(props: SkygaugePhotorealProps) {
  // `undefined` = still resolving. Empty string = resolved but key is missing
  // on every layer (UI surfaces an error). Non-empty string = ready.
  const [resolvedKey, setResolvedKey] = useState<string | undefined>(() =>
    BUILD_TIME_KEY && BUILD_TIME_KEY.length > 0 ? BUILD_TIME_KEY : undefined,
  );

  useEffect(() => {
    if (resolvedKey !== undefined) return;
    let cancelled = false;

    fetch('/api/skygauge/maps-key', { cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{ key?: string; source?: string }>;
      })
      .then((body) => {
        if (cancelled) return;
        setResolvedKey(typeof body.key === 'string' ? body.key : '');
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error('[skygauge/photoreal] maps-key fetch failed:', error);
        setResolvedKey('');
      });

    return () => {
      cancelled = true;
    };
  }, [resolvedKey]);

  if (resolvedKey === undefined) {
    return <LoadingFallback message="Resolving photoreal credentials…" />;
  }

  return (
    <SceneErrorBoundary
      label="Photoreal tiles failed to load"
      height={props.height ?? '100%'}
    >
      <SkygaugePhotorealInnerDynamic {...props} googleKey={resolvedKey || undefined} />
    </SceneErrorBoundary>
  );
}

function LoadingFallback({ message }: { message?: string } = {}) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-muted/30">
      <span className="text-xs text-muted-foreground">
        {message ?? 'Fetching photoreal module… (dynamic import)'}
      </span>
    </div>
  );
}
