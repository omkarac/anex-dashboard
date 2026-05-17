import Link from 'next/link';
import { ASSET_STATUS_LABELS } from '@/lib/enums/asset';
import type { PipelineStage } from '@/lib/queries/dashboard';

const ACTIVE_CONFIG: Record<string, { bar: string; label: string }> = {
  open:       { bar: 'bg-slate-600/80',   label: 'text-slate-100' },
  evaluating: { bar: 'bg-indigo-500',     label: 'text-white' },
  screened:   { bar: 'bg-violet-600',     label: 'text-white' },
};

function formatCr(v: number): string {
  if (v === 0) return '—';
  if (v >= 1000) return `₹${(v / 1000).toFixed(1)}K Cr`;
  return `₹${Math.round(v)} Cr`;
}

export function PipelineFunnel({ stages }: { stages: PipelineStage[] }) {
  const activeStages = stages.filter((s) => s.status !== 'won' && s.status !== 'dropped');
  const exitStages   = stages.filter((s) => s.status === 'won' || s.status === 'dropped');
  const maxCount      = Math.max(...activeStages.map((s) => s.count), 1);
  const totalValue    = activeStages.reduce((sum, s) => sum + s.value, 0);
  const totalCount    = activeStages.reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="border border-border rounded-xl bg-card shadow-sm flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Pipeline Funnel
        </h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          <span className="font-semibold text-foreground">{totalCount}</span> active
          <span className="text-border mx-1.5">·</span>
          <span className="font-semibold text-foreground">{formatCr(totalValue)}</span>
        </span>
      </div>

      {/* Funnel */}
      <div className="flex flex-col gap-2 px-5 pb-4 flex-1">
        {activeStages.map(({ status, count, value }) => {
          const cfg = ACTIVE_CONFIG[status] ?? { bar: 'bg-slate-400', label: 'text-white' };
          // Minimum 18% so there's always readable bar; scale up from there
          const widthPct = count === 0 ? 8 : Math.max(18, (count / maxCount) * 100);
          const marginPct = (100 - widthPct) / 2;

          return (
            <Link
              key={status}
              href={`/capital-markets/assets?status=${status}`}
              className="block group"
            >
              {/* Stage label row */}
              <div className="flex items-center justify-between mb-1 px-0.5">
                <span className="text-[11px] font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                  {ASSET_STATUS_LABELS[status]}
                </span>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground tabular-nums">
                  <span>{formatCr(value)}</span>
                  <span className="font-bold text-foreground/80 text-sm w-5 text-right">{count}</span>
                </div>
              </div>

              {/* Funnel bar — centered, proportional */}
              <div className="relative h-8">
                <div
                  className={`h-full rounded-md ${cfg.bar} group-hover:brightness-110 transition-all duration-300 flex items-center`}
                  style={{ marginLeft: `${marginPct}%`, width: `${widthPct}%` }}
                >
                  {/* Subtle inner highlight */}
                  <div className="absolute inset-x-0 top-0 h-px rounded-t-md bg-white/20" />
                </div>
              </div>
            </Link>
          );
        })}

        {activeStages.every((s) => s.count === 0) && (
          <p className="text-xs text-muted-foreground text-center py-6">No active deals in pipeline.</p>
        )}
      </div>

      {/* Exit stages footer */}
      <div className="border-t border-dashed border-border px-5 py-3 flex items-center gap-5 flex-wrap bg-muted/20">
        {exitStages.map(({ status, count, value }) => {
          const isWon = status === 'won';
          return (
            <Link
              key={status}
              href={`/capital-markets/assets?status=${status}`}
              className="flex items-center gap-2 group"
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${isWon ? 'bg-emerald-400' : 'bg-muted-foreground/40'}`}
              />
              <span className="text-[11px] text-muted-foreground group-hover:text-foreground transition-colors">
                {ASSET_STATUS_LABELS[status]}
              </span>
              <span className="text-[11px] font-semibold tabular-nums text-foreground/70">{count}</span>
              {value > 0 && (
                <span className="text-[11px] text-muted-foreground tabular-nums">· {formatCr(value)}</span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}