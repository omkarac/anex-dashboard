'use client';

import React from 'react';
import { MapPin } from 'lucide-react';
import { LocationMap } from './location-map';

export function LocationSection({
  sharedMarkets,
  interestedMarkets,
  appetiteMarkets,
}: {
  sharedMarkets: string[];
  interestedMarkets: string[];
  appetiteMarkets?: string[];
}) {
  const hasActivity = sharedMarkets.length > 0 || interestedMarkets.length > 0;
  if (!hasActivity) return null;

  const uniqueCount = new Set([...sharedMarkets, ...interestedMarkets]).size;

  return (
    <section className="rounded-xl border p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Deal Geography</p>
        </div>
        <span className="text-[10px] tabular-nums text-muted-foreground">
          {uniqueCount} {uniqueCount === 1 ? 'micro-market' : 'micro-markets'}
        </span>
      </div>

      <LocationMap
        appetiteMarkets={appetiteMarkets ?? []}
        sharedMarkets={sharedMarkets}
        interestedMarkets={interestedMarkets}
      />

      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
        {sharedMarkets.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-yellow-400 shrink-0" />
            <span className="text-[10px] text-muted-foreground">Shared</span>
          </div>
        )}
        {interestedMarkets.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
            <span className="text-[10px] text-muted-foreground">Interested / Pursuing / Won</span>
          </div>
        )}
        {(appetiteMarkets?.length ?? 0) > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0" />
            <span className="text-[10px] text-muted-foreground">Appetite</span>
          </div>
        )}
      </div>
    </section>
  );
}
