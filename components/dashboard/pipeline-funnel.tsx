import Link from 'next/link';
import { ASSET_STATUS_LABELS } from '@/lib/enums/asset';
import type { PipelineStage } from '@/lib/queries/dashboard';

const STAGE_CONFIG: Record<string, { bar: string; dot: string }> = {
  open:       { bar: 'bg-slate-300',   dot: 'bg-slate-400' },
  evaluating: { bar: 'bg-indigo-400',  dot: 'bg-indigo-500' },
  screened:   { bar: 'bg-sky-400',     dot: 'bg-sky-500' },
  won:        { bar: 'bg-emerald-400', dot: 'bg-emerald-500' },
  dropped:    { bar: 'bg-slate-200',   dot: 'bg-slate-300' },
};

function formatCr(v: number): string {
  if (v === 0) return '—';
  if (v >= 1000) return `₹${(v / 1000).toFixed(1)}K Cr`;
  return `₹${Math.round(v)} Cr`;
}

export function PipelineFunnel({ stages }: { stages: PipelineStage[] }) {
  const activeStages = stages.filter((s) => s.status !== 'won' && s.status !== 'dropped');
  const exitStages = stages.filter((s) => s.status === 'won' || s.status === 'dropped');
  const maxValue = Math.max(...activeStages.map((s) => s.value), 1);
  const totalActiveValue = activeStages.reduce((sum, s) => sum + s.value, 0);
  const totalActiveCount = activeStages.reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="border rounded-md p-5 flex flex-col gap-5 h-full">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-400">
          Pipeline
        </h2>
        <span className="text-[11px] text-slate-400 tabular-nums">
          {totalActiveCount} active · {formatCr(totalActiveValue)}
        </span>
      </div>

      <div className="flex flex-col gap-4">
        {activeStages.map(({ status, count, value }) => {
          const cfg = STAGE_CONFIG[status];
          const barPct = value === 0 ? 0 : Math.max(3, (value / maxValue) * 100);

          return (
            <Link
              key={status}
              href={`/capital-markets/assets?status=${status}`}
              className="group flex flex-col gap-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-700 group-hover:text-slate-900 transition-colors">
                  {ASSET_STATUS_LABELS[status]}
                </span>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span className="tabular-nums">{formatCr(value)}</span>
                  <span className="tabular-nums font-semibold text-slate-900 w-5 text-right">{count}</span>
                </div>
              </div>
              <div className="h-[5px] rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${cfg.bar}`}
                  style={{ width: `${barPct}%` }}
                />
              </div>
            </Link>
          );
        })}
      </div>

      <div className="border-t border-dashed border-slate-200 pt-3 flex items-center gap-5">
        {exitStages.map(({ status, count, value }) => {
          const cfg = STAGE_CONFIG[status];
          return (
            <Link
              key={status}
              href={`/capital-markets/assets?status=${status}`}
              className="flex items-center gap-2 group"
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
              <span className="text-xs text-slate-500 group-hover:text-slate-700 transition-colors">
                {ASSET_STATUS_LABELS[status]}
              </span>
              <span className="text-xs font-semibold tabular-nums text-slate-700">{count}</span>
              {value > 0 && (
                <span className="text-xs text-slate-400">· {formatCr(value)}</span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
