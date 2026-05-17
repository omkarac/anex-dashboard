import Link from 'next/link';
import { ASSET_STATUS_LABELS } from '@/lib/enums/asset';
import type { BoardDeal } from '@/lib/queries/dashboard';

function formatCr(v: number): string {
  if (v === 0) return '—';
  if (v >= 1000) return `₹${(v / 1000).toFixed(1)}K Cr`;
  return `₹${Math.round(v)} Cr`;
}

function StaleBadge({ days }: { days: number }) {
  const cls =
    days >= 60
      ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400'
      : 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400';
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${cls}`}>
      {days}d
    </span>
  );
}

export function StaleDealsWidget({ deals }: { deals: BoardDeal[] }) {
  return (
    <div className="border border-border rounded-xl bg-card shadow-sm flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Stale Pipeline
        </h2>
        <span
          className={`text-[11px] font-semibold ${
            deals.length > 0 ? 'text-amber-500' : 'text-muted-foreground'
          }`}
        >
          {deals.length} deal{deals.length !== 1 ? 's' : ''} · 30d+
        </span>
      </div>

      <div className="flex-1 overflow-auto px-5 pb-5">
        {deals.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8">
            <div className="w-7 h-7 rounded-full bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
            </div>
            <p className="text-xs text-muted-foreground">Pipeline is moving — no stale deals</p>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {deals.map((deal) => (
              <Link
                key={deal.id}
                href={`/capital-markets/assets/${deal.id}`}
                className="group flex items-center gap-3 py-2.5"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors truncate">
                    {deal.property_name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[11px] text-muted-foreground">
                      {ASSET_STATUS_LABELS[deal.status]}
                    </span>
                    {deal.owner && (
                      <>
                        <span className="text-border text-[11px]">·</span>
                        <span className="text-[11px] text-muted-foreground truncate">{deal.owner}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {deal.topline_cr > 0 && (
                    <span className="text-[11px] text-muted-foreground tabular-nums hidden sm:inline">
                      {formatCr(deal.topline_cr)}
                    </span>
                  )}
                  <StaleBadge days={deal.days_since_activity} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
