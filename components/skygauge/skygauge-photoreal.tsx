'use client';

import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';
import type SkygaugePhotorealInner from './skygauge-photoreal-inner';
import { SceneErrorBoundary } from './scene-error-boundary';

// IMPORTANT — `NEXT_PUBLIC_*` env vars are inlined by Next.js at build time,
// but in Next.js 16 + Turbopack the inlining can fail to reach a chunk that's
// split off via `dynamic(() => import(...), { ssr: false })`: the value is
// `undefined` in the dynamic chunk even when the deployed build has the env
// var set. We read the var here, in the wrapper (which sits in the main
// client bundle), and pass it down as a prop so the inner component never
// has to rely on the env-var read happening in its own chunk.
const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

type SkygaugePhotorealProps = Omit<
  ComponentProps<typeof SkygaugePhotorealInner>,
  'googleKey'
>;

// Map3DElement (and the `maps3d` library it ships in) are browser-only and
// pull a fair amount of code in lazily — keep it out of the initial bundle.
const SkygaugePhotorealInnerDynamic = dynamic(() => import('./skygauge-photoreal-inner'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-muted/30">
      <span className="text-xs text-muted-foreground">
        Fetching photoreal module… (dynamic import)
      </span>
    </div>
  ),
});

export function SkygaugePhotoreal(props: SkygaugePhotorealProps) {
  return (
    <SceneErrorBoundary
      label="Photoreal tiles failed to load"
      height={props.height ?? '100%'}
    >
      <SkygaugePhotorealInnerDynamic {...props} googleKey={GOOGLE_KEY} />
    </SceneErrorBoundary>
  );
}
