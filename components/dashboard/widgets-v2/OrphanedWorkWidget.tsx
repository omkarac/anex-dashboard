import Link from 'next/link';
import type { OrphanedWork } from '@/lib/queries/dashboard-productivity';

interface Props {
  data: OrphanedWork;
}

export function OrphanedWorkWidget({ data }: Props) {
  const total = data.total_assets + data.total_tasks;

  return (
    <div className="border border-border rounded-xl bg-card shadow-sm flex flex-col h-full overflow-hidden">
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Orphaned Work
          </h2>
          {total > 0 && (
            <span className="text-[10px] font-semibold text-rose-500 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-full tabular-nums">
              {total}
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-1 mt-2">
          <span className="text-2xl font-bold text-foreground tabular-nums">{data.total_assets}</span>
          <span className="text-[11px] text-muted-foreground">assets</span>
          <span className="text-muted-foreground/40 mx-1">·</span>
          <span className="text-2xl font-bold text-foreground tabular-nums">{data.total_tasks}</span>
          <span className="text-[11px] text-muted-foreground">tasks</span>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-5 pb-5">
        {data.items.length === 0 ? (
          <p className="text-[11px] text-muted-foreground italic text-center py-4">
            No orphaned work — handover is clean.
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            {data.items.slice(0, 6).map((it) => (
              <Link
                key={`${it.kind}-${it.id}`}
                href={it.kind === 'asset' ? `/capital-markets/assets/${it.id}` : '/capital-markets/team'}
                className="group flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/60 transition-colors"
              >
                <span className={`text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-sm ${
                  it.kind === 'asset' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                }`}>
                  {it.kind}
                </span>
                <span className="text-xs text-foreground truncate flex-1 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors">
                  {it.label}
                </span>
                <span className="text-[10px] text-muted-foreground/70 tabular-nums shrink-0">
                  {it.days_orphaned}d
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
