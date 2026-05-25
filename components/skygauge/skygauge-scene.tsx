'use client';

import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';
import type SkygaugeSceneInner from './skygauge-scene-inner';

type SkygaugeSceneProps = ComponentProps<typeof SkygaugeSceneInner>;

// three / R3F / drei are heavy and browser-only — load them lazily so they never
// enter the SSR bundle or the 2D-map path.
const SkygaugeSceneInnerDynamic = dynamic(() => import('./skygauge-scene-inner'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-muted/30">
      <span className="text-xs text-muted-foreground">Loading 3D scene…</span>
    </div>
  ),
});

export function SkygaugeScene(props: SkygaugeSceneProps) {
  return <SkygaugeSceneInnerDynamic {...props} />;
}
