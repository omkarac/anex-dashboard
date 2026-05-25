'use client';

import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';
import type SkygaugePhotorealInner from './skygauge-photoreal-inner';
import { SceneErrorBoundary } from './scene-error-boundary';

type SkygaugePhotorealProps = ComponentProps<typeof SkygaugePhotorealInner>;

// three + 3d-tiles-renderer are heavy and browser-only — load lazily.
const SkygaugePhotorealInnerDynamic = dynamic(() => import('./skygauge-photoreal-inner'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-muted/30">
      <span className="text-xs text-muted-foreground">Loading photoreal tiles…</span>
    </div>
  ),
});

export function SkygaugePhotoreal(props: SkygaugePhotorealProps) {
  return (
    <SceneErrorBoundary
      label="Photoreal tiles failed to load"
      height={props.height ?? '100%'}
    >
      <SkygaugePhotorealInnerDynamic {...props} />
    </SceneErrorBoundary>
  );
}
