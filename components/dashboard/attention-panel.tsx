import Link from 'next/link';
import { ASSET_STATUS_LABELS } from '@/lib/enums/asset';
import type { AttentionSignal } from '@/lib/queries/dashboard';

const REASON_CONFIG: Record<AttentionSignal['reason'], { label: string; classes: string }> = {
  hot_unassigned: { label: 'No Owner',  classes: 'text-rose-600 bg-rose-50' },
  hot_silent:     { label: '7d+ Silent', classes: 'text-amber-700 bg-amber-50' },
  stale_stage:    { label: 'Stalled',   classes: 'text-slate-600 bg-slate-100' },
};

export function AttentionPanel({ signals }: { signals: AttentionSignal[] }) {
  return (
    <div className="border rounded-md p-5 flex flex-col gap-5 h-full">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-400">
          Needs Attention
        </h2>
        {signals.length > 0 && (
          <span className="text-[11px] font-semibold text-rose-500">
            {signals.length} signal{signals.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {signals.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-1.5 py-6">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <p className="text-xs text-slate-400">All deals look healthy.</p>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-slate-100">
          {signals.map((signal) => {
            const rc = REASON_CONFIG[signal.reason];
            return (
              <Link
                key={signal.id}
                href={`/capital-markets/assets/${signal.id}`}
                className="flex items-center gap-3 py-2.5 group"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-900 truncate group-hover:text-indigo-700 transition-colors">
                    {signal.property_name}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {ASSET_STATUS_LABELS[signal.status]} · {signal.detail}
                  </p>
                </div>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${rc.classes}`}>
                  {rc.label}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
