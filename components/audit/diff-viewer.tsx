import { ArrowRight } from 'lucide-react';
import type { AuditDiff } from '@/lib/queries/logs';
import { formatDateTime } from '@/lib/utils/formatters';

function formatValue(v: unknown): string {
  if (v == null || v === '') return '—';
  if (Array.isArray(v)) return v.length ? v.join(', ') : '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function DiffRows({ diff }: { diff: NonNullable<AuditDiff> }) {
  const before = diff.before ?? {};
  const after = diff.after ?? {};
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();

  const changed = keys.filter((k) => formatValue(before[k]) !== formatValue(after[k]));

  if (changed.length === 0) {
    return <p className="text-xs text-muted-foreground">No field-level changes recorded.</p>;
  }

  return (
    <div className="space-y-1.5">
      {changed.map((key) => (
        <div key={key} className="grid grid-cols-[140px_1fr] gap-2 text-xs items-start">
          <span className="font-medium text-muted-foreground">{key}</span>
          <span className="flex items-center gap-1.5 flex-wrap font-mono">
            <span className="rounded bg-red-50 text-red-700 px-1.5 py-0.5 line-through decoration-red-300">
              {formatValue(before[key])}
            </span>
            <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="rounded bg-emerald-50 text-emerald-700 px-1.5 py-0.5">
              {formatValue(after[key])}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

export function EventDetail({
  diff,
  entityType,
  entityId,
  createdAt,
  summary,
  deletedAt,
  deleteReason,
}: {
  diff: AuditDiff;
  entityType: string;
  entityId: string;
  createdAt: string;
  summary: string;
  deletedAt: string | null;
  deleteReason: string | null;
}) {
  return (
    <div className="space-y-3 rounded-md bg-muted/30 p-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Summary</p>
        <p className="text-sm">{summary}</p>
      </div>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
          Field changes
        </p>
        {diff && (diff.before || diff.after) ? (
          <DiffRows diff={diff} />
        ) : (
          <p className="text-xs text-muted-foreground">No field-level detail captured for this event.</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs pt-1 border-t">
        <div className="flex justify-between gap-2">
          <span className="text-muted-foreground">Timestamp</span>
          <span className="font-mono">{formatDateTime(createdAt)}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-muted-foreground">Entity</span>
          <span className="font-mono">{entityType}</span>
        </div>
        <div className="flex justify-between gap-2 col-span-2">
          <span className="text-muted-foreground">Entity ID</span>
          <span className="font-mono truncate max-w-[60%]" title={entityId}>{entityId}</span>
        </div>
        {deletedAt && (
          <div className="flex justify-between gap-2 col-span-2 text-destructive">
            <span>Struck from record</span>
            <span className="font-mono">{deleteReason ?? 'No reason'}</span>
          </div>
        )}
      </div>
    </div>
  );
}
