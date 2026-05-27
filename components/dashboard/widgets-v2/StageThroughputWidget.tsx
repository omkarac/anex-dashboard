import { ASSET_STATUS_LABELS } from '@/lib/enums/asset';
import type { StageThroughput } from '@/lib/queries/dashboard-productivity';

interface Props {
  data: StageThroughput;
}

export function StageThroughputWidget({ data }: Props) {
  const max = Math.max(1, ...data.stages.flatMap((s) => [s.median_days_historical, s.avg_days_current_cohort]));

  return (
    <div className="border border-border rounded-xl bg-card shadow-sm flex flex-col h-full overflow-hidden">
      <div className="px-5 pt-5 pb-3">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Stage Throughput
        </h2>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Median days per stage · 90-day window
        </p>
      </div>

      <div className="flex-1 overflow-auto px-5 pb-5 flex flex-col gap-4">
        {data.stages.map((s) => {
          const slowerNow = s.avg_days_current_cohort > s.median_days_historical && s.median_days_historical > 0;
          const tone = slowerNow ? 'text-rose-500' : s.median_days_historical > 0 ? 'text-emerald-500' : 'text-muted-foreground';
          return (
            <div key={s.status} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-foreground">{ASSET_STATUS_LABELS[s.status]}</span>
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {s.current_count} live
                  </span>
                </div>
                <span className={`text-[10px] font-semibold tabular-nums ${tone}`}>
                  {s.avg_days_current_cohort >= 0 ? `${s.avg_days_current_cohort}d now` : '—'}
                  <span className="text-muted-foreground font-normal"> · {s.median_days_historical}d med</span>
                </span>
              </div>
              {/* dual bars: historical median + current cohort avg */}
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-muted-foreground/70 w-12 tabular-nums">historical</span>
                  <div className="flex-1 bg-muted/40 rounded-sm overflow-hidden h-2 relative">
                    <div
                      className="absolute inset-y-0 left-0 bg-muted-foreground/40 rounded-sm transition-all"
                      style={{ width: `${(s.median_days_historical / max) * 100}%` }}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-muted-foreground/70 w-12 tabular-nums">current</span>
                  <div className="flex-1 bg-muted/40 rounded-sm overflow-hidden h-2 relative">
                    <div
                      className={`absolute inset-y-0 left-0 rounded-sm transition-all ${
                        slowerNow ? 'bg-rose-400 dark:bg-rose-500' : 'bg-indigo-400 dark:bg-indigo-500'
                      }`}
                      style={{ width: `${(s.avg_days_current_cohort / max) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
