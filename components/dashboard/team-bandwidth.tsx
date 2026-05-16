import type { MemberWorkload } from '@/lib/queries/dashboard';

function LoadIndicator({ load }: { load: number }) {
  const filled = Math.min(Math.ceil(load / 3), 5);
  const color =
    filled >= 5 ? 'bg-rose-400'
    : filled >= 4 ? 'bg-amber-400'
    : filled >= 3 ? 'bg-amber-300'
    : 'bg-indigo-300';

  return (
    <div className="flex items-center gap-1" aria-label={`Load: ${load}`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className={`w-1.5 h-1.5 rounded-full transition-colors ${i < filled ? color : 'bg-slate-200'}`}
        />
      ))}
    </div>
  );
}

export function TeamBandwidth({ workload }: { workload: MemberWorkload[] }) {
  const sorted = [...workload].sort(
    (a, b) => (b.open_tasks + b.spoc_assets) - (a.open_tasks + a.spoc_assets),
  );

  return (
    <div className="border rounded-md p-5 flex flex-col gap-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-400">Team</h2>
        <span className="text-[11px] text-slate-400">{sorted.length} members</span>
      </div>

      {sorted.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-4">No team members found.</p>
      ) : (
        <div className="flex flex-col divide-y divide-slate-100">
          {sorted.map((m) => (
            <div key={m.member_id} className="flex items-center gap-3 py-2.5">
              <div className="h-7 w-7 rounded-full bg-slate-900 flex items-center justify-center text-[11px] font-semibold text-white shrink-0">
                {m.full_name[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-800 truncate">{m.full_name}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {m.spoc_assets} deal{m.spoc_assets !== 1 ? 's' : ''} ·{' '}
                  {m.open_tasks} task{m.open_tasks !== 1 ? 's' : ''}
                </p>
              </div>
              <LoadIndicator load={m.open_tasks + m.spoc_assets} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
