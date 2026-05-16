import type { DealAging } from '@/lib/queries/dashboard';

type Bucket = { key: keyof DealAging; label: string; bar: string; text: string };

const BUCKETS: Bucket[] = [
  { key: 'under7',  label: '< 7 days',    bar: 'bg-emerald-400', text: 'text-emerald-700' },
  { key: 'd7to30',  label: '7 – 30 days', bar: 'bg-sky-400',     text: 'text-sky-700' },
  { key: 'd30to60', label: '30 – 60 days', bar: 'bg-amber-400',  text: 'text-amber-700' },
  { key: 'over60',  label: '60+ days',    bar: 'bg-rose-400',    text: 'text-rose-700' },
];

export function DealAgingWidget({ aging }: { aging: DealAging }) {
  const total = aging.under7 + aging.d7to30 + aging.d30to60 + aging.over60;
  const max = Math.max(aging.under7, aging.d7to30, aging.d30to60, aging.over60, 1);

  return (
    <div className="border rounded-md p-5 flex flex-col gap-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-400">
          Time in Stage
        </h2>
        <span className="text-[11px] text-slate-400 tabular-nums">{total} active</span>
      </div>

      <div className="flex flex-col gap-3.5">
        {BUCKETS.map(({ key, label, bar, text }) => {
          const count = aging[key];
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <div key={key} className="flex items-center gap-3">
              <span className="text-[11px] text-slate-500 w-[5.5rem] shrink-0">{label}</span>
              <div className="flex-1 h-[5px] rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-full ${bar}`}
                  style={{ width: `${(count / max) * 100}%` }}
                />
              </div>
              <div className="flex items-center gap-1.5 shrink-0 w-14 justify-end">
                <span className={`text-xs font-semibold tabular-nums ${count > 0 ? text : 'text-slate-300'}`}>
                  {count}
                </span>
                <span className="text-[11px] text-slate-400 w-6 text-right">{pct > 0 ? `${pct}%` : ''}</span>
              </div>
            </div>
          );
        })}
      </div>

      {aging.over60 > 0 && (
        <p className="text-[11px] text-rose-500 font-medium border-t border-slate-100 pt-3 -mb-1">
          {aging.over60} deal{aging.over60 !== 1 ? 's' : ''} stalled 60+ days — review recommended
        </p>
      )}
    </div>
  );
}
