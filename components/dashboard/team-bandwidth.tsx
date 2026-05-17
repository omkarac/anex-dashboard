import type { MemberWorkload } from '@/lib/queries/dashboard';

const RING_RADIUS = 17;
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function loadColor(pct: number): string {
  if (pct >= 0.85) return '#f87171'; // rose-400
  if (pct >= 0.55) return '#fbbf24'; // amber-400
  if (pct >= 0.25) return '#818cf8'; // indigo-400
  return '#94a3b8'; // slate-400
}

function LoadRing({ load, max }: { load: number; max: number }) {
  const pct = max > 0 ? Math.min(load / max, 1) : 0;
  const offset = CIRCUMFERENCE * (1 - pct);
  const color = loadColor(pct);

  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 40 40"
      className="absolute inset-0"
      style={{ transform: 'rotate(-90deg)' }}
      aria-hidden
    >
      {/* Track */}
      <circle cx="20" cy="20" r={RING_RADIUS} fill="none" strokeWidth="2.5" className="stroke-muted" />
      {/* Arc */}
      {load > 0 && (
        <circle
          cx="20"
          cy="20"
          r={RING_RADIUS}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

function LoadLabel({ load, max }: { load: number; max: number }) {
  const pct = max > 0 ? Math.min(load / max, 1) : 0;
  if (pct === 0) return <span className="text-[10px] text-muted-foreground/50 font-medium">free</span>;
  if (pct >= 0.85) return <span className="text-[10px] text-rose-500 font-semibold">high</span>;
  if (pct >= 0.55) return <span className="text-[10px] text-amber-500 font-semibold">busy</span>;
  return <span className="text-[10px] text-indigo-400 font-medium">ok</span>;
}

export function TeamBandwidth({ workload }: { workload: MemberWorkload[] }) {
  const sorted = [...workload].sort(
    (a, b) => b.open_tasks + b.spoc_assets - (a.open_tasks + a.spoc_assets),
  );
  const maxLoad = Math.max(...sorted.map((m) => m.open_tasks + m.spoc_assets), 1);

  return (
    <div className="border border-border rounded-xl bg-card shadow-sm p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Team Bandwidth
        </h2>
        <span className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{sorted.length}</span> members
        </span>
      </div>

      {sorted.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">No team members found.</p>
      ) : (
        <div className="flex flex-col divide-y divide-border">
          {sorted.map((m) => {
            const load = m.open_tasks + m.spoc_assets;
            return (
              <div key={m.member_id} className="flex items-center gap-3.5 py-3">
                {/* Avatar with load ring */}
                <div className="relative w-10 h-10 shrink-0">
                  <LoadRing load={load} max={maxLoad} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[12px] font-bold text-foreground/60 select-none">
                      {m.full_name[0].toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Name + detail */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">{m.full_name}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">
                    {m.spoc_assets} deal{m.spoc_assets !== 1 ? 's' : ''}
                    <span className="text-border mx-1">·</span>
                    {m.open_tasks} task{m.open_tasks !== 1 ? 's' : ''}
                  </p>
                </div>

                {/* Load state label */}
                <LoadLabel load={load} max={maxLoad} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
