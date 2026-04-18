import { cn } from '@/lib/utils';
import { ASSET_TEMPERATURE_COLORS, ASSET_TEMPERATURE_LABELS } from '@/lib/enums/asset';
import type { AssetTemperature } from '@/lib/schemas/asset';

const DOTS: Record<AssetTemperature, string> = {
  hot: '🔴',
  warm: '🟡',
  cold: '🔵',
  none: '',
};

export function TemperatureBadge({ temperature }: { temperature: AssetTemperature }) {
  if (temperature === 'none') return <span className="text-muted-foreground text-xs">—</span>;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium',
        ASSET_TEMPERATURE_COLORS[temperature]
      )}
    >
      <span aria-hidden="true">{DOTS[temperature]}</span>
      {ASSET_TEMPERATURE_LABELS[temperature]}
    </span>
  );
}
