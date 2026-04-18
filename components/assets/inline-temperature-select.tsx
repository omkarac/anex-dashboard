'use client';

import { useState, useTransition, useEffect, useRef } from 'react';
import { TemperatureBadge } from '@/components/assets/temperature-badge';
import { updateAssetTemperature } from '@/lib/actions/assets';
import { ASSET_TEMPERATURE_LABELS } from '@/lib/enums/asset';
import type { AssetTemperature } from '@/lib/schemas/asset';

const ALL_TEMPS = Object.keys(ASSET_TEMPERATURE_LABELS) as AssetTemperature[];

export function InlineTemperatureSelect({
  assetId,
  current,
}: {
  assetId: string;
  current: AssetTemperature;
}) {
  const [optimistic, setOptimistic] = useState(current);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  function select(temp: AssetTemperature) {
    if (temp === optimistic) { setOpen(false); return; }
    setOptimistic(temp);
    setOpen(false);
    startTransition(async () => {
      const result = await updateAssetTemperature(assetId, temp);
      if (!result.ok) setOptimistic(current);
    });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        disabled={isPending}
        className="cursor-pointer disabled:opacity-60"
      >
        <TemperatureBadge temperature={optimistic} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 min-w-[140px] max-h-48 overflow-y-auto rounded-md border bg-popover shadow-md">
          <div className="p-1">
            {ALL_TEMPS.map((t) => (
              <button
                key={t}
                onClick={() => select(t)}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted/60"
              >
                <TemperatureBadge temperature={t} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
