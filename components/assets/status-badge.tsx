import { cn } from '@/lib/utils';
import { ASSET_STATUS_COLORS, ASSET_STATUS_LABELS } from '@/lib/enums/asset';
import type { AssetStatus } from '@/lib/schemas/asset';

export function StatusBadge({ status }: { status: AssetStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        ASSET_STATUS_COLORS[status]
      )}
    >
      {ASSET_STATUS_LABELS[status]}
    </span>
  );
}
