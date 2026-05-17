import type { CommandStats } from '@/lib/queries/dashboard';

const RADIUS = 26;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS; // ≈ 163.4

function getQuarterLabel(): string {
  const now = new Date();
  return `Q${Math.floor(now.getMonth() / 3) + 1} ${now.getFullYear()}`;
}

function arcColor(rate: number): string {
  if (rate >= 60) return '#34d399'; // emerald-400
  if (rate >= 40) return '#fbbf24'; // amber-400
  if (rate > 0)  return '#f87171'; // rose-400
  return '#94a3b8'; // slate-400
}

export function WinRateWidget({ stats }: { stats: CommandStats }) {
  const { winRate, wonCountQ } = stats;
  const droppedCountQ = wonCountQ > 0 && winRate > 0
    ? Math.round(wonCountQ * (100 - winRate) / winRate)
    : 0;
  const total = wonCountQ + droppedCountQ;
  const quarter = getQuarterLabel();
  const pct = winRate / 100;
  const offset = CIRCUMFERENCE * (1 - pct);
  const color = arcColor(winRate);

  return (
    <div className="border border-border rounded-xl bg-card shadow-sm p-5 flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Win Rate
        </h2>
        <span className="text-[10px] text-muted-foreground font-medium">{quarter}</span>
      </div>

      {/* Donut gauge */}
      <div className="flex items-center gap-5">
        <div className="relative w-[68px] h-[68px] shrink-0">
          <svg
            width="68"
            height="68"
            viewBox="0 0 68 68"
            style={{ transform: 'rotate(-90deg)' }}
            aria-hidden
          >
            {/* Track */}
            <circle
              cx="34" cy="34" r={RADIUS}
              fill="none"
              strokeWidth="8"
              className="stroke-muted"
            />
            {/* Arc */}
            {winRate > 0 && (
              <circle
                cx="34" cy="34" r={RADIUS}
                fill="none"
                stroke={color}
                strokeWidth="8"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={offset}
                strokeLinecap="round"
              />
            )}
          </svg>
          {/* Center label */}
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className="text-[15px] font-bold tabular-nums leading-none"
              style={{ color }}
            >
              {winRate}%
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="flex flex-col gap-3 flex-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground tabular-nums">{wonCountQ}</p>
              <p className="text-[10px] text-muted-foreground">won</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-muted-foreground/30 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground tabular-nums">{droppedCountQ}</p>
              <p className="text-[10px] text-muted-foreground">dropped</p>
            </div>
          </div>
          {total > 0 && (
            <div className="border-t border-border pt-2">
              <p className="text-[10px] text-muted-foreground">
                <span className="font-semibold text-foreground tabular-nums">{total}</span> closed this quarter
              </p>
            </div>
          )}
        </div>
      </div>

      {winRate === 0 && (
        <p className="text-[11px] text-muted-foreground text-center -mt-1">
          No closed deals this quarter yet
        </p>
      )}
    </div>
  );
}
