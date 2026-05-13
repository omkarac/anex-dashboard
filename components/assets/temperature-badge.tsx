import { cn } from '@/lib/utils';
import { ASSET_TEMPERATURE_COLORS, ASSET_TEMPERATURE_LABELS } from '@/lib/enums/asset';
import type { AssetTemperature } from '@/lib/schemas/asset';

export function TemperatureBadge({ temperature }: { temperature: AssetTemperature }) {
  if (temperature === 'none') return <span className="text-muted-foreground text-xs">—</span>;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium',
        ASSET_TEMPERATURE_COLORS[temperature]
      )}
    >
      {ASSET_TEMPERATURE_LABELS[temperature]}
    </span>
  );
}
