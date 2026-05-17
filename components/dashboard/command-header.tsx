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
  const winColor =
    stats.winRate >= 60
      ? 'text-emerald-400'
      : stats.winRate >= 40
        ? 'text-amber-300'
        : stats.winRate > 0
          ? 'text-rose-400'
          : 'text-slate-600';

  return (
    <div className="bg-slate-950 text-white shrink-0">
      <div className="h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />

      <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-white/[0.06]">
        {/* Active Pipeline */}
        <div className="relative px-6 py-6 overflow-hidden group cursor-default">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/[0.07] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 mb-3">
            Active Pipeline
          </p>
          <p className="text-[2.25rem] font-bold tabular-nums tracking-tight leading-none text-white">
            {formatCr(stats.activePipelineValue)}
          </p>
          <div className="flex items-center gap-2 mt-2.5">
            <span className="text-xs text-slate-500 font-medium">
              {stats.activeCount} opportunit{stats.activeCount === 1 ? 'y' : 'ies'} live
            </span>
          </div>
        </div>

        {/* Open Deals */}
        <div className="relative px-6 py-6 overflow-hidden group cursor-default">
          <div className="absolute inset-0 bg-gradient-to-br from-sky-500/[0.07] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 mb-3">
            Deals in Pipeline
          </p>
          <p className="text-[2.25rem] font-bold tabular-nums tracking-tight leading-none text-white">
            {stats.activeCount}
          </p>
          <p className="text-xs text-slate-500 font-medium mt-2.5">open · evaluating · screened</p>
        </div>

        {/* Hot Deals */}
        <div className="relative px-6 py-6 overflow-hidden group cursor-default">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/[0.09] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-500/70 mb-3">
            Hot Deals
          </p>
          <div className="flex items-center gap-3">
            <p
              className={`text-[2.25rem] font-bold tabular-nums tracking-tight leading-none ${
                stats.hotCount > 0 ? 'text-amber-300' : 'text-slate-600'
              }`}
            >
              {stats.hotCount}
            </p>
            {stats.hotCount > 0 && (
              <div className="relative flex h-2.5 w-2.5 mb-1 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-60" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
              </div>
            )}
          </div>
          <p className="text-xs text-slate-500 font-medium mt-2.5">
            {stats.hotCount === 0 ? 'none flagged hot' : 'require immediate attention'}
          </p>
        </div>

        {/* Win Rate */}
        <div className="relative px-6 py-6 overflow-hidden group cursor-default">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.07] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 mb-3">
            Win Rate — {quarter}
          </p>
          <div className="flex items-end gap-1.5">
            <p className={`text-[2.25rem] font-bold tabular-nums tracking-tight leading-none ${winColor}`}>
              {stats.winRate}
            </p>
            <span className="text-xl text-slate-600 font-normal mb-[3px]">%</span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-2.5">
            {stats.wonCountQ} deal{stats.wonCountQ !== 1 ? 's' : ''} closed this quarter
          </p>
        </div>
      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" />
    </div>
  );
}
