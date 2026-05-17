'use client';

import dynamic from 'next/dynamic';
import type { LocationMapProps } from './location-map-inner';

const LocationMapInner = dynamic(() => import('./location-map-inner'), {
  ssr: false,
  loading: () => (
    <div
      style={{ height: '280px' }}
      className="w-full rounded-lg bg-muted/40 animate-pulse"
    />
  ),
});

export function LocationMap(props: LocationMapProps) {
  return <LocationMapInner {...props} />;
}
