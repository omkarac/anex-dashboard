import Link from 'next/link';
import { ASSET_STATUS_LABELS } from '@/lib/enums/asset';
import type { AttentionSignal } from '@/lib/queries/dashboard';

const REASON_CONFIG: Record<
  AttentionSignal['reason'],
  { label: string; badge: string }
> = {
  hot_unassigned: { label: 'No Owner',   badge: 'bg-rose-100 text-rose-700' },
  hot_silent:     { label: '7d Silent',  badge: 'bg-rose-100 text-rose-700' },
  stale_stage:    { label: 'Stalled',    badge: 'bg-amber-100 text-amber-700' },
};

export function AttentionPanel({ signals }: { signals: AttentionSignal[] }) {
  const highCount = signals.filter((s) => s.severity === 'high').length;

  return (
    <div className="border border-border rounded-xl bg-card shadow-sm flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Needs Attention
        </h2>
        {signals.length > 0 && (
          <div className="flex items-center gap-1.5">
            {highCount > 0 && (
              <div className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500" />
              </div>
            )}
            <span className="text-[11px] font-semibold text-rose-500">
              {signals.length} signal{signals.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto px-5 pb-5">
        {signals.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 h-full">
            <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            </div>
            <p className="text-xs text-muted-foreground font-medium">All deals look healthy</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {signals.map((signal) => {
              const rc = REASON_CONFIG[signal.reason];
              const isHigh = signal.severity === 'high';

              return (
                <Link
                  key={signal.id}
                  href={`/capital-markets/assets/${signal.id}`}
                  className={`flex items-start gap-3 p-3 rounded-lg border transition-all hover:shadow-sm group ${
                    isHigh
                      ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50 hover:border-rose-300 dark:hover:border-rose-800'
                      : 'bg-amber-50/30 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900/50 hover:border-amber-200 dark:hover:border-amber-800'
                  }`}
                >
                  {/* Severity indicator */}
                  <div className="mt-1 shrink-0">
                    {isHigh ? (
                      <div className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
                      </div>
                    ) : (
                      <span className="inline-flex rounded-full h-2 w-2 bg-amber-400" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate group-hover:text-indigo-500 transition-colors">
                      {signal.property_name}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {ASSET_STATUS_LABELS[signal.status]} · {signal.detail}
                    </p>
                  </div>

                  {/* Reason badge */}
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${rc.badge}`}>
                    {rc.label}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
