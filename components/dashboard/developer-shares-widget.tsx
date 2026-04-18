import type { DeveloperShareStat } from '@/lib/queries/dashboard';

export function DeveloperSharesWidget({
  totalShares,
  top5,
}: {
  totalShares: number;
  top5: DeveloperShareStat[];
}) {
  return (
    <div className="rounded-lg border p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Developer Shares
        </h2>
        <span className="text-xs text-muted-foreground">{totalShares} total</span>
      </div>

      {top5.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">No shares yet.</p>
      ) : (
        <div className="flex flex-col gap-1">
          {top5.map((dev, i) => {
            const max = top5[0].share_count;
            return (
              <div key={dev.developer_id} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-4 text-right">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-medium truncate">{dev.developer_name}</span>
                    <span className="text-xs tabular-nums ml-2 shrink-0">{dev.share_count}</span>
                  </div>
                  <div className="h-1.5 rounded bg-muted overflow-hidden">
                    <div
                      className="h-full rounded bg-primary/40"
                      style={{ width: `${(dev.share_count / max) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
