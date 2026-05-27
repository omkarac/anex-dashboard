import type { QuietAssetsByOwner, QuietBucket } from '@/lib/queries/dashboard-productivity';

const BUCKET_LABEL: Record<QuietBucket, string> = {
  fresh: '<3d',
  d3to7: '3-7d',
  d7to14: '7-14d',
  d14to30: '14-30d',
  over30: '30+d',
};

const BUCKETS: QuietBucket[] = ['fresh', 'd3to7', 'd7to14', 'd14to30', 'over30'];

function cellClass(bucket: QuietBucket, count: number, max: number): string {
  if (count === 0) return 'bg-muted/30 text-muted-foreground/40';
  const intensity = max > 0 ? count / max : 0;

  if (bucket === 'fresh') return intensity > 0.6 ? 'bg-emerald-500 text-white' : intensity > 0.3 ? 'bg-emerald-300 text-emerald-900' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300';
  if (bucket === 'd3to7') return intensity > 0.6 ? 'bg-indigo-400 text-white' : intensity > 0.3 ? 'bg-indigo-200 text-indigo-900' : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300';
  if (bucket === 'd7to14') return intensity > 0.6 ? 'bg-amber-400 text-white' : intensity > 0.3 ? 'bg-amber-200 text-amber-900' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300';
  if (bucket === 'd14to30') return intensity > 0.6 ? 'bg-orange-500 text-white' : intensity > 0.3 ? 'bg-orange-300 text-orange-900' : 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300';
  return intensity > 0.6 ? 'bg-rose-600 text-white' : intensity > 0.3 ? 'bg-rose-400 text-white' : 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300';
}

interface Props {
  data: QuietAssetsByOwner;
}

export function QuietAssetsOwnerWidget({ data }: Props) {
  const max = Math.max(1, ...data.rows.flatMap((r) => Object.values(r.buckets)));

  return (
    <div className="border border-border rounded-xl bg-card shadow-sm flex flex-col h-full overflow-hidden">
      <div className="px-5 pt-5 pb-3">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Quiet Assets by Owner
        </h2>
        <p className="text-[11px] text-muted-foreground mt-0.5">Days since last touch · per owner</p>
      </div>

      <div className="flex-1 overflow-auto px-5 pb-5">
        {data.rows.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">No owned assets to show.</p>
        ) : (
          <div className="w-full">
            {/* header row */}
            <div className="grid grid-cols-[1fr_repeat(5,_minmax(0,_1fr))] gap-1 mb-1.5">
              <div />
              {BUCKETS.map((b) => (
                <div key={b} className="text-[9px] text-muted-foreground/70 uppercase tracking-wider text-center font-medium">
                  {BUCKET_LABEL[b]}
                </div>
              ))}
            </div>
            {/* rows */}
            <div className="flex flex-col gap-1">
              {data.rows.map((row) => (
                <div key={row.member_id} className="grid grid-cols-[1fr_repeat(5,_minmax(0,_1fr))] gap-1 items-center">
                  <div className="text-[11px] font-medium text-foreground truncate pr-2">
                    {row.full_name}
                  </div>
                  {BUCKETS.map((b) => {
                    const n = row.buckets[b];
                    return (
                      <div
                        key={b}
                        className={`h-7 rounded flex items-center justify-center text-[11px] font-semibold tabular-nums transition-colors ${cellClass(b, n, max)}`}
                        title={`${row.full_name} — ${BUCKET_LABEL[b]}: ${n}`}
                      >
                        {n > 0 ? n : ''}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
