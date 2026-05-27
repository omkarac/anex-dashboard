import type { TaskSla } from '@/lib/queries/dashboard-productivity';

function pctColor(pct: number): string {
  if (pct >= 90) return 'text-emerald-500';
  if (pct >= 70) return 'text-indigo-500';
  if (pct >= 50) return 'text-amber-500';
  return 'text-rose-500';
}

function barColor(pct: number): string {
  if (pct >= 90) return 'bg-emerald-400 dark:bg-emerald-500';
  if (pct >= 70) return 'bg-indigo-400 dark:bg-indigo-500';
  if (pct >= 50) return 'bg-amber-400 dark:bg-amber-500';
  return 'bg-rose-400 dark:bg-rose-500';
}

interface Props {
  data: TaskSla;
}

export function TaskSlaWidget({ data }: Props) {
  return (
    <div className="border border-border rounded-xl bg-card shadow-sm flex flex-col h-full overflow-hidden">
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <div>
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Task SLA — high &amp; urgent
          </h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">On-time completion · last 30 days</p>
        </div>
        <div className="flex items-baseline gap-1">
          <span className={`text-xl font-bold tabular-nums ${pctColor(data.overall_pct)}`}>
            {data.overall_pct}%
          </span>
          <span className="text-[10px] text-muted-foreground tabular-nums">
            ({data.total_tasks})
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-5 pb-5">
        {data.rows.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            No high/urgent tasks completed in the last 30 days.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {data.rows.map((r) => (
              <div key={r.member_id} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[11px] font-medium text-foreground truncate">{r.full_name}</span>
                    <span className="text-[10px] text-muted-foreground tabular-nums shrink-0 ml-2">
                      {r.on_time}/{r.total}
                    </span>
                  </div>
                  <div className="bg-muted/40 rounded-sm overflow-hidden h-1.5 relative">
                    <div
                      className={`absolute inset-y-0 left-0 rounded-sm transition-all ${barColor(r.on_time_pct)}`}
                      style={{ width: `${r.on_time_pct}%` }}
                    />
                  </div>
                </div>
                <span className={`text-[11px] font-semibold tabular-nums w-10 text-right ${pctColor(r.on_time_pct)}`}>
                  {r.on_time_pct}%
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
