import Link from 'next/link';
import { ASSET_STATUS_LABELS } from '@/lib/enums/asset';
import type { StatusCount } from '@/lib/queries/dashboard';

const STATUS_ORDER = [
  'evaluating',
  'evaluated',
  'won',
  'dropped',
] as const;

const STATUS_BAR_COLORS: Record<string, string> = {
  evaluating: 'bg-amber-300',
  evaluated: 'bg-orange-300',
  won: 'bg-green-400',
  dropped: 'bg-red-300',
};

export function PipelineWidget({ counts }: { counts: StatusCount[] }) {
  const countMap = new Map(counts.map((c) => [c.status, c.count]));
  const max = Math.max(...counts.map((c) => c.count), 1);

  const rows = STATUS_ORDER.map((s) => ({ status: s, count: countMap.get(s) ?? 0 }));

  return (
    <div className="rounded-lg border p-4 flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Pipeline Funnel
      </h2>
      <div className="flex flex-col gap-2">
        {rows.map(({ status, count }) => (
          <div key={status} className="flex items-center gap-2">
            <Link
              href={`/capital-markets/assets?status=${status}`}
              className="w-36 shrink-0 text-xs text-right text-muted-foreground hover:text-foreground transition-colors truncate"
            >
              {ASSET_STATUS_LABELS[status]}
            </Link>
            <div className="flex-1 h-5 rounded bg-muted overflow-hidden">
              <div
                className={`h-full rounded transition-all ${STATUS_BAR_COLORS[status]}`}
                style={{ width: count === 0 ? '0%' : `${Math.max(2, (count / max) * 100)}%` }}
              />
            </div>
            <span className="w-8 text-right text-xs tabular-nums font-medium">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
