'use client';

import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';
import type SkygaugeMapInner from './skygauge-map-inner';

type SkygaugeMapProps = ComponentProps<typeof SkygaugeMapInner>;

const SkygaugeMapInnerDynamic = dynamic(() => import('./skygauge-map-inner'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-muted/30 animate-pulse" />
  ),
});

export function SkygaugeMap(props: SkygaugeMapProps) {
  return <SkygaugeMapInnerDynamic {...props} />;
}
