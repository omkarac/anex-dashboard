import type { DealAging } from '@/lib/queries/dashboard';

type Segment = {
  key: keyof DealAging;
  label: string;
  sublabel: string;
  bar: string;
  countColor: string;
};

const SEGMENTS: Segment[] = [
  { key: 'under7',  label: '< 7d',    sublabel: 'fresh',   bar: 'bg-emerald-400', countColor: 'text-emerald-600 dark:text-emerald-400' },
  { key: 'd7to30',  label: '7–30d',   sublabel: 'active',  bar: 'bg-sky-400',     countColor: 'text-sky-600 dark:text-sky-400' },
  { key: 'd30to60', label: '30–60d',  sublabel: 'slowing', bar: 'bg-amber-400',   countColor: 'text-amber-600 dark:text-amber-400' },
  { key: 'over60',  label: '60+ d',   sublabel: 'stalled', bar: 'bg-rose-400',    countColor: 'text-rose-600 dark:text-rose-400' },
];

export function DealAgingWidget({ aging }: { aging: DealAging }) {
  const total = SEGMENTS.reduce((s, seg) => s + aging[seg.key], 0);

  return (
    <div className="border border-border rounded-xl bg-card shadow-sm p-5 flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Time in Stage
        </h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          <span className="font-semibold text-foreground">{total}</span> active
        </span>
      </div>

      {/* Stacked proportional bar */}
      {total === 0 ? (
        <div className="h-7 rounded-lg bg-muted" />
      ) : (
        <div className="h-7 rounded-lg overflow-hidden flex gap-0.5">
          {SEGMENTS.map((seg) => {
            const count = aging[seg.key];
            if (count === 0) return null;
            return (
              <div
                key={seg.key}
                className={`h-full ${seg.bar} first:rounded-l-lg last:rounded-r-lg transition-all duration-500`}
                style={{ width: `${(count / total) * 100}%` }}
                title={`${seg.label}: ${count} deal${count !== 1 ? 's' : ''}`}
              />
            );
          })}
        </div>
      )}

      {/* Count legend */}
      <div className="grid grid-cols-4 gap-2">
        {SEGMENTS.map((seg) => {
          const count = aging[seg.key];
          return (
            <div key={seg.key} className="flex flex-col gap-0.5">
              <span
                className={`text-2xl font-bold tabular-nums tracking-tight ${
                  count > 0 ? seg.countColor : 'text-foreground/20'
                }`}
              >
                {count}
              </span>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                {seg.label}
              </span>
              <span className="text-[10px] text-muted-foreground/50">{seg.sublabel}</span>
            </div>
          );
        })}
      </div>

      {/* Warning */}
      {aging.over60 > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/40 px-3 py-2 -mt-1">
          <div className="relative flex h-1.5 w-1.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500" />
          </div>
          <p className="text-[11px] text-rose-600 font-medium">
            {aging.over60} deal{aging.over60 !== 1 ? 's' : ''} stalled 60+ days — review recommended
          </p>
        </div>
      )}
    </div>
  );
}
