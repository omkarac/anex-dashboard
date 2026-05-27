import Link from 'next/link';
import type { HandoffHealth, HandoffStage } from '@/lib/queries/dashboard-productivity';

const STAGE_LABEL: Record<HandoffStage, string> = {
  shared: 'Shared',
  im: 'IM sent',
  ff: 'FF sent',
  eoi: 'EOI',
};

const STAGE_COLOR: Record<HandoffStage, string> = {
  shared: 'bg-slate-400',
  im: 'bg-indigo-400',
  ff: 'bg-amber-400',
  eoi: 'bg-emerald-500',
};

function StageBar({ reached }: { reached: HandoffStage }) {
  const stages: HandoffStage[] = ['shared', 'im', 'ff', 'eoi'];
  const idx = stages.indexOf(reached);
  return (
    <div className="flex items-center gap-0.5">
      {stages.map((s, i) => (
        <span
          key={s}
          className={`block h-1.5 w-3.5 rounded-sm ${i <= idx ? STAGE_COLOR[s] : 'bg-muted'}`}
          title={STAGE_LABEL[s]}
        />
      ))}
    </div>
  );
}

interface Props {
  data: HandoffHealth;
}

export function HandoffHealthWidget({ data }: Props) {
  const { shares, totals, stage_medians_days } = data;
  const conversionToIm = totals.shared > 0 ? Math.round((totals.im / totals.shared) * 100) : 0;
  const stalledCount = shares.filter((s) => s.is_stalled).length;

  return (
    <div className="border border-border rounded-xl bg-card shadow-sm flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div>
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Handoff Health
          </h2>
          <p className="text-[11px] text-foreground/80 mt-0.5 tabular-nums">
            <span className="font-semibold">{conversionToIm}%</span>
            <span className="text-muted-foreground"> share → IM · median {stage_medians_days.im}d</span>
          </p>
        </div>
        {stalledCount > 0 && (
          <span className="text-[10px] font-semibold text-rose-500 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-full tabular-nums">
            {stalledCount} stalled
          </span>
        )}
      </div>

      {/* Funnel mini-strip */}
      <div className="px-5 pb-3">
        <div className="grid grid-cols-4 gap-1 text-center">
          {([
            ['Shared', totals.shared, 'text-slate-500'],
            ['IM', totals.im, 'text-indigo-500'],
            ['FF', totals.ff, 'text-amber-500'],
            ['EOI', totals.eoi, 'text-emerald-500'],
          ] as const).map(([label, n, colorClass]) => (
            <div key={label} className="flex flex-col items-center py-1.5 rounded-md bg-muted/40">
              <span className={`text-sm font-bold tabular-nums ${colorClass}`}>{n}</span>
              <span className="text-[9px] text-muted-foreground uppercase tracking-wider mt-0.5">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto px-5 pb-5">
        {shares.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">No active shares.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {shares.slice(0, 8).map((s) => (
              <Link
                key={s.share_id}
                href={`/capital-markets/assets/${s.asset_id}`}
                className={`group flex items-center gap-3 px-2.5 py-2 rounded-md transition-colors ${
                  s.is_stalled
                    ? 'border border-rose-200 dark:border-rose-900/40 bg-rose-50/40 dark:bg-rose-950/10 hover:bg-rose-50 dark:hover:bg-rose-950/20'
                    : 'hover:bg-muted/60'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors">
                    {s.property_name}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">{s.developer_name}</p>
                </div>
                <StageBar reached={s.stage_reached} />
                <span
                  className={`text-[10px] font-semibold tabular-nums shrink-0 w-10 text-right ${
                    s.is_stalled ? 'text-rose-500' : 'text-muted-foreground'
                  }`}
                >
                  {s.days_in_stage}d
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
