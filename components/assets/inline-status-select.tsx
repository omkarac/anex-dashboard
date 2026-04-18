'use client';

import { useState, useTransition, useEffect, useRef } from 'react';
import { StatusBadge } from '@/components/assets/status-badge';
import { updateAssetStatus } from '@/lib/actions/assets';
import { ASSET_STATUS_LABELS } from '@/lib/enums/asset';
import type { AssetStatus } from '@/lib/schemas/asset';

const ALL_STATUSES = Object.keys(ASSET_STATUS_LABELS) as AssetStatus[];

export function InlineStatusSelect({
  assetId,
  current,
}: {
  assetId: string;
  current: AssetStatus;
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

  function select(status: AssetStatus) {
    if (status === optimistic) { setOpen(false); return; }
    setOptimistic(status);
    setOpen(false);
    startTransition(async () => {
      const result = await updateAssetStatus(assetId, status);
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
        <StatusBadge status={optimistic} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 min-w-[180px] max-h-56 overflow-y-auto rounded-md border bg-popover shadow-md">
          <div className="p-1">
            {ALL_STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => select(s)}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted/60"
              >
                <StatusBadge status={s} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
