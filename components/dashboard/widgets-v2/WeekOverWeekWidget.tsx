import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { WeekOverWeek } from '@/lib/queries/dashboard-productivity';

function delta(thisWeek: number, lastWeek: number) {
  const diff = thisWeek - lastWeek;
  const pct = lastWeek > 0 ? Math.round((diff / lastWeek) * 100) : thisWeek > 0 ? 100 : 0;
  return { diff, pct };
}

interface Props {
  data: WeekOverWeek;
}

export function WeekOverWeekWidget({ data }: Props) {
  const max = Math.max(1, ...data.metrics.flatMap((m) => [m.this_week, m.last_week]));

  return (
    <div className="border border-border rounded-xl bg-card shadow-sm flex flex-col h-full overflow-hidden">
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <div>
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            This Week vs Last
          </h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            ISO week starting {new Date(data.week_start_iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-5 pb-5 flex flex-col gap-3">
        {data.metrics.map((m) => {
          const { diff, pct } = delta(m.this_week, m.last_week);
          const trendColor = diff > 0 ? 'text-emerald-500' : diff < 0 ? 'text-rose-500' : 'text-muted-foreground';
          const TrendIcon = diff > 0 ? TrendingUp : diff < 0 ? TrendingDown : Minus;

          return (
            <div key={m.label} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-foreground">{m.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground tabular-nums">{m.this_week}</span>
                  <span className={`flex items-center gap-0.5 text-[10px] font-semibold tabular-nums ${trendColor}`}>
                    <TrendIcon className="w-3 h-3" />
                    {diff > 0 ? '+' : ''}{diff} ({pct > 0 ? '+' : ''}{pct}%)
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 h-3">
                <div className="flex-1 bg-muted/40 rounded-sm overflow-hidden h-2 relative">
                  <div
                    className="absolute inset-y-0 left-0 bg-indigo-400 dark:bg-indigo-500 rounded-sm"
                    style={{ width: `${(m.this_week / max) * 100}%` }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-1 h-3 -mt-1">
                <div className="flex-1 bg-muted/40 rounded-sm overflow-hidden h-1.5 relative">
                  <div
                    className="absolute inset-y-0 left-0 bg-muted-foreground/40 rounded-sm"
                    style={{ width: `${(m.last_week / max) * 100}%` }}
                  />
                </div>
                <span className="text-[9px] text-muted-foreground/60 tabular-nums w-6 text-right">{m.last_week}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-border px-5 py-2 bg-muted/20 flex items-center justify-between text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-1 rounded-sm bg-indigo-400" /> This week
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-1 rounded-sm bg-muted-foreground/40" /> Last week
        </span>
      </div>
    </div>
  );
}
