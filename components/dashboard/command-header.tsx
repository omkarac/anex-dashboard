import type { CommandStats } from '@/lib/queries/dashboard';

function formatCr(value: number): string {
  if (value === 0) return '₹0 Cr';
  if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K Cr`;
  return `₹${Math.round(value)} Cr`;
}

function getQuarterLabel(): string {
  const now = new Date();
  const q = Math.floor(now.getMonth() / 3) + 1;
  return `Q${q} ${now.getFullYear()}`;
}

export function CommandHeader({ stats }: { stats: CommandStats }) {
  const quarter = getQuarterLabel();

  return (
    <div className="bg-slate-900 text-white shrink-0 grid grid-cols-2 lg:grid-cols-4 divide-x divide-slate-700/50">
      <div className="px-6 py-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-400 mb-2">
          Active Pipeline
        </p>
        <p className="text-[2rem] font-semibold tabular-nums tracking-tight leading-none">
          {formatCr(stats.activePipelineValue)}
        </p>
        <p className="text-[11px] text-slate-500 mt-2">
          across {stats.activeCount} opportunit{stats.activeCount === 1 ? 'y' : 'ies'}
        </p>
      </div>

      <div className="px-6 py-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-400 mb-2">
          Opportunities
        </p>
        <p className="text-[2rem] font-semibold tabular-nums tracking-tight leading-none">
          {stats.activeCount}
        </p>
        <p className="text-[11px] text-slate-500 mt-2">open · evaluating · screened</p>
      </div>

      <div className="px-6 py-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-amber-400/80 mb-2">
          Hot Deals
        </p>
        <p className="text-[2rem] font-semibold tabular-nums tracking-tight leading-none text-amber-300">
          {stats.hotCount}
        </p>
        <p className="text-[11px] text-slate-500 mt-2">
          {stats.hotCount === 0 ? 'none flagged' : 'require active attention'}
        </p>
      </div>

      <div className="px-6 py-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-400 mb-2">
          Win Rate — {quarter}
        </p>
        <p className="text-[2rem] font-semibold tabular-nums tracking-tight leading-none">
          {stats.winRate}
          <span className="text-xl text-slate-500 font-normal">%</span>
        </p>
        <p className="text-[11px] text-slate-500 mt-2">
          {stats.wonCountQ} deal{stats.wonCountQ !== 1 ? 's' : ''} closed this quarter
        </p>
      </div>
    </div>
  );
}
