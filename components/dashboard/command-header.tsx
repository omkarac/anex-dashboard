import type { CommandStats } from '@/lib/queries/dashboard';

const DONUT_R = 22;
const DONUT_C = 2 * Math.PI * DONUT_R; // ≈ 138.2

function formatCr(value: number): string {
  if (value === 0) return '₹0 Cr';
  if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K Cr`;
  return `₹${Math.round(value)} Cr`;
}

function getQuarterLabel(): string {
  const q = Math.floor(new Date().getMonth() / 3) + 1;
  return `Q${q} ${new Date().getFullYear()}`;
}

function winArcColor(rate: number): string {
  if (rate >= 60) return '#34d399';
  if (rate >= 40) return '#fbbf24';
  if (rate > 0) return '#f87171';
  return '#334155';
}

export function CommandHeader({ stats }: { stats: CommandStats }) {
  const quarter = getQuarterLabel();
  const { activePipelineValue, activeCount, hotCount, winRate, wonCountQ, droppedCountQ } = stats;
  const totalClosed = wonCountQ + droppedCountQ;
  const arcColor = winArcColor(winRate);
  const arcOffset = DONUT_C * (1 - winRate / 100);

  return (
    <div className="bg-slate-950 shrink-0 select-none">
      <div className="h-px bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent" />

      <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-white/[0.06]">

        {/* ── 1. Active Pipeline ──────────────────────────────────────── */}
        <div className="relative group px-6 py-5 overflow-hidden col-span-1">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/[0.08] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-duration-500 pointer-events-none" />

          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500 mb-3">
            Active Pipeline
          </p>

          <p className="text-[2rem] font-bold tabular-nums tracking-tight leading-none text-white">
            {formatCr(activePipelineValue)}
          </p>

          {/* Deal count chip */}
          <div className="flex items-center gap-2 mt-3">
            <span className="inline-flex items-center gap-1.5 bg-white/[0.06] text-slate-300 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-white/[0.08]">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
              {activeCount} deals
            </span>
          </div>
        </div>

        {/* ── 2. Hot Deals ────────────────────────────────────────────── */}
        <div className="relative group px-6 py-5 overflow-hidden col-span-1">
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-duration-500 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at 20% 50%, rgba(251,191,36,0.07) 0%, transparent 70%)' }}
          />

          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-amber-500/60 mb-3">
            Hot Deals
          </p>

          <div className="flex items-center gap-3">
            <p className={`text-[2rem] font-bold tabular-nums tracking-tight leading-none ${hotCount > 0 ? 'text-amber-300' : 'text-slate-600'}`}>
              {hotCount}
            </p>

            {hotCount > 0 && (
              /* Pulsing ring around the number — visual urgency signal */
              <div className="relative flex items-center justify-center w-5 h-5 shrink-0">
                <span className="animate-ping absolute inline-flex w-full h-full rounded-full bg-amber-400/50" />
                <span className="relative w-2 h-2 rounded-full bg-amber-400" />
              </div>
            )}
          </div>

          <p className="text-[11px] text-slate-500 font-medium mt-3">
            {hotCount === 0
              ? 'none flagged hot'
              : hotCount === 1
                ? 'needs immediate attention'
                : 'need immediate attention'}
          </p>
        </div>

        {/* ── 3. Win Rate ─────────────────────────────────────────────── */}
        <div className="relative group px-6 py-5 overflow-hidden col-span-1">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.06] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-duration-500 pointer-events-none" />

          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500 mb-3">
            Win Rate · {quarter}
          </p>

          <div className="flex items-center gap-4">
            {/* Inline donut gauge */}
            <div className="relative shrink-0 w-[52px] h-[52px]">
              <svg width="52" height="52" viewBox="0 0 52 52" style={{ transform: 'rotate(-90deg)' }} aria-hidden>
                <circle cx="26" cy="26" r={DONUT_R} fill="none" strokeWidth="6" className="stroke-slate-800" />
                {winRate > 0 && (
                  <circle
                    cx="26" cy="26" r={DONUT_R}
                    fill="none"
                    stroke={arcColor}
                    strokeWidth="6"
                    strokeDasharray={DONUT_C}
                    strokeDashoffset={arcOffset}
                    strokeLinecap="round"
                  />
                )}
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[11px] font-bold tabular-nums leading-none" style={{ color: arcColor }}>
                  {winRate}%
                </span>
              </div>
            </div>

            <div>
              <p className="text-[2rem] font-bold tabular-nums tracking-tight leading-none text-white">
                {winRate}<span className="text-[1.1rem] text-slate-500 font-normal ml-0.5">%</span>
              </p>
              <p className="text-[11px] text-slate-500 font-medium mt-1">
                {totalClosed === 0 ? 'no closures yet' : `${totalClosed} closed this quarter`}
              </p>
            </div>
          </div>
        </div>

        {/* ── 4. Closed Q ─────────────────────────────────────────────── */}
        <div className="relative group px-6 py-5 overflow-hidden col-span-1">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-500/[0.05] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-duration-500 pointer-events-none" />

          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500 mb-3">
            Closed · {quarter}
          </p>

          {totalClosed === 0 ? (
            <p className="text-[2rem] font-bold tabular-nums tracking-tight leading-none text-slate-700">—</p>
          ) : (
            <>
              <div className="flex items-end gap-4">
                <div>
                  <p className="text-[2rem] font-bold tabular-nums tracking-tight leading-none text-emerald-400">
                    {wonCountQ}
                  </p>
                  <p className="text-[10px] font-semibold text-emerald-500/70 mt-1 uppercase tracking-wide">won</p>
                </div>

                {droppedCountQ > 0 && (
                  <>
                    <div className="w-px h-8 bg-white/[0.06] self-end mb-1 shrink-0" />
                    <div>
                      <p className="text-[2rem] font-bold tabular-nums tracking-tight leading-none text-slate-500">
                        {droppedCountQ}
                      </p>
                      <p className="text-[10px] font-semibold text-slate-600 mt-1 uppercase tracking-wide">dropped</p>
                    </div>
                  </>
                )}
              </div>

              {/* Visual split bar */}
              {totalClosed > 0 && (
                <div className="flex gap-0.5 mt-3.5 h-1 rounded-full overflow-hidden w-full max-w-[100px]">
                  <div
                    className="bg-emerald-400/70 rounded-full"
                    style={{ width: `${(wonCountQ / totalClosed) * 100}%` }}
                  />
                  <div
                    className="bg-slate-700 rounded-full flex-1"
                  />
                </div>
              )}
            </>
          )}

          {totalClosed === 0 && (
            <p className="text-[11px] text-slate-600 font-medium mt-3">no closures yet</p>
          )}
        </div>

      </div>

      <div className="h-px bg-gradient-to-r from-transparent via-white/[0.04] to-transparent" />
    </div>
  );
}
