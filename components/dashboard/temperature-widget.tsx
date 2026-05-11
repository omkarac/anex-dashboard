import Link from 'next/link';
import { ASSET_TEMPERATURE_LABELS, ASSET_TEMPERATURE_COLORS } from '@/lib/enums/asset';
import type { TempCount } from '@/lib/queries/dashboard';
import type { AssetTemperature } from '@/lib/schemas/asset';

const TEMP_ORDER: AssetTemperature[] = ['hot', 'warm', 'cold', 'none'];

export function TemperatureWidget({ counts }: { counts: TempCount[] }) {
  const countMap = new Map(counts.map((c) => [c.temperature, c.count]));
  const total = counts.reduce((s, c) => s + c.count, 0);

  return (
    <div className="rounded-lg border p-4 flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Temperature
      </h2>
      <div className="flex flex-col gap-2">
        {TEMP_ORDER.map((temp) => {
          const count = countMap.get(temp) ?? 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <Link
              key={temp}
              href={`/capital-markets/assets?temperature=${temp}`}
              className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-muted/40 transition-colors group"
            >
              <div className="flex items-center gap-2">
                <span className={`rounded border px-2 py-0.5 text-xs font-medium ${ASSET_TEMPERATURE_COLORS[temp]}`}>
                  {ASSET_TEMPERATURE_LABELS[temp]}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{pct}%</span>
                <span className="text-sm font-semibold tabular-nums w-6 text-right">{count}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
