import Link from 'next/link';
import { ASSET_STATUS_LABELS } from '@/lib/enums/asset';
import type { EngagementCoverage } from '@/lib/queries/dashboard-productivity';

interface Props {
  data: EngagementCoverage;
}

export function EngagementCoverageWidget({ data }: Props) {
  const pct = data.coverage_pct;
  const tone = pct >= 80 ? 'text-emerald-500' : pct >= 50 ? 'text-amber-500' : 'text-rose-500';
  const barTone = pct >= 80 ? 'bg-emerald-400 dark:bg-emerald-500' : pct >= 50 ? 'bg-amber-400 dark:bg-amber-500' : 'bg-rose-400 dark:bg-rose-500';

  return (
    <div className="border border-border rounded-xl bg-card shadow-sm flex flex-col h-full overflow-hidden">
      <div className="px-5 pt-5 pb-3">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Engagement Coverage
        </h2>
        <div className="flex items-baseline gap-1 mt-2">
          <span className={`text-3xl font-bold tabular-nums ${tone}`}>{pct}%</span>
          <span className="text-[11px] text-muted-foreground tabular-nums">
            ({data.with_engagement}/{data.active_assets})
          </span>
        </div>
        <div className="mt-2 bg-muted/40 rounded-sm overflow-hidden h-1.5 relative">
          <div className={`absolute inset-y-0 left-0 rounded-sm ${barTone}`} style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="flex-1 overflow-auto px-5 pb-5">
        {data.uncovered_examples.length === 0 ? (
          <p className="text-[11px] text-muted-foreground italic text-center py-4">
            All active deals have live engagements.
          </p>
        ) : (
          <>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-2">
              Without engagement
            </p>
            <div className="flex flex-col gap-1">
              {data.uncovered_examples.slice(0, 5).map((a) => (
                <Link
                  key={a.id}
                  href={`/capital-markets/assets/${a.id}`}
                  className="group flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/60 transition-colors"
                >
                  <span className="text-xs text-foreground truncate flex-1 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors">
                    {a.property_name}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{ASSET_STATUS_LABELS[a.status]}</span>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
