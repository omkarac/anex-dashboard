import type { MemberWorkload } from '@/lib/queries/dashboard';

export function TeamWorkloadWidget({ workload }: { workload: MemberWorkload[] }) {
  const sorted = [...workload].sort((a, b) => (b.open_tasks + b.spoc_assets) - (a.open_tasks + a.spoc_assets));
  const maxTasks = Math.max(...sorted.map((m) => m.open_tasks), 1);

  return (
    <div className="rounded-lg border p-4 flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Team Workload
      </h2>

      {sorted.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">No team members found.</p>
      ) : (
        <div className="flex flex-col divide-y">
          {sorted.map((m) => (
            <div key={m.member_id} className="flex items-center gap-3 py-2">
              <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium shrink-0">
                {m.full_name[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{m.full_name}</p>
                <div className="mt-1 h-1.5 rounded bg-muted overflow-hidden">
                  <div
                    className="h-full rounded bg-blue-400"
                    style={{ width: `${(m.open_tasks / maxTasks) * 100}%` }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
                <span title="Open tasks">
                  <span className="font-semibold text-foreground">{m.open_tasks}</span> tasks
                </span>
                <span title="SPOC assets">
                  <span className="font-semibold text-foreground">{m.spoc_assets}</span> assets
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
