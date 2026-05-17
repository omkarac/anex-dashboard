import Link from 'next/link';
import { ASSET_STATUS_LABELS } from '@/lib/enums/asset';
import type { BoardDeal } from '@/lib/queries/dashboard';

function formatCr(v: number): string {
  if (v === 0) return '—';
  if (v >= 1000) return `₹${(v / 1000).toFixed(1)}K Cr`;
  return `₹${Math.round(v)} Cr`;
}

function daysLabel(d: number) {
  if (d === 0) return 'today';
  if (d === 1) return '1d';
  return `${d}d`;
}

export function HotDealsWidget({ deals }: { deals: BoardDeal[] }) {
  return (
    <div className="border border-border rounded-xl bg-card shadow-sm flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Hot Deals
          </h2>
          {deals.length > 0 && (
            <div className="relative flex h-1.5 w-1.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-70" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500" />
            </div>
          )}
        </div>
        <span className="text-[11px] font-semibold text-rose-500">
          {deals.length} deal{deals.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="flex-1 overflow-auto px-5 pb-5">
        {deals.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8">
            <div className="w-7 h-7 rounded-full bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
            </div>
            <p className="text-xs text-muted-foreground">No hot deals active</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {deals.map((deal) => {
              const isUrgent =
                (deal.temperature === 'hot' && deal.is_unassigned) || deal.is_hot_silent;
              return (
                <Link
                  key={deal.id}
                  href={`/capital-markets/assets/${deal.id}`}
                  className={`group flex items-start gap-3 p-3 rounded-lg border transition-all hover:shadow-sm ${
                    isUrgent
                      ? 'border-rose-200 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/20 hover:border-rose-300 dark:hover:border-rose-800'
                      : 'border-amber-100 dark:border-amber-900/40 bg-amber-50/20 dark:bg-amber-950/10 hover:border-amber-200'
                  }`}
                >
                  <span className="inline-block w-2 h-2 rounded-full bg-rose-500 shrink-0 mt-1" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors truncate">
                      {deal.property_name}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[11px] text-muted-foreground truncate">
                        {deal.owner ?? <span className="italic text-muted-foreground/60">Unassigned</span>}
                      </span>
                      <span className="text-border text-[11px]">·</span>
                      <span className="text-[11px] text-muted-foreground">
                        {ASSET_STATUS_LABELS[deal.status]}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span
                      className={`text-[11px] font-semibold tabular-nums ${
                        deal.days_since_activity >= 7 ? 'text-rose-500 dark:text-rose-400' : 'text-muted-foreground'
                      }`}
                    >
                      {daysLabel(deal.days_since_activity)}
                    </span>
                    {deal.topline_cr > 0 && (
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        {formatCr(deal.topline_cr)}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {deals.length > 0 && (
        <div className="border-t border-border px-5 py-2.5 bg-muted/20">
          <Link
            href="/capital-markets/assets?temperature=hot"
            className="text-[11px] font-semibold text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
          >
            View all hot deals →
          </Link>
        </div>
      )}
    </div>
  );
}
