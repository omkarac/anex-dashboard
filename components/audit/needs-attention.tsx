import { ShieldAlert } from 'lucide-react';
import { formatDateTime } from '@/lib/utils/formatters';
import { actionLabel, actionColor, FLAG_LABELS, FLAG_COLORS } from '@/lib/enums/audit';
import type { FlaggedEvent } from '@/lib/queries/audit';

export function NeedsAttention({ events }: { events: FlaggedEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="rounded-lg border bg-card">
        <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
          <ShieldAlert className="h-8 w-8 text-emerald-500" />
          <p className="text-sm font-medium">Nothing needs attention</p>
          <p className="text-xs text-muted-foreground">No deletions, status reversals, after-hours edits, or bulk actions in view.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {events.length} sensitive event{events.length !== 1 ? 's' : ''} flagged for review.
      </p>
      {events.map((e) => (
        <div key={e.id} className="rounded-lg border bg-card p-3 flex items-start gap-3">
          <div className="flex flex-wrap gap-1 shrink-0 w-28">
            {e.flags.map((f) => (
              <span key={f} className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold ${FLAG_COLORS[f]}`}>
                {FLAG_LABELS[f]}
              </span>
            ))}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium ${actionColor(e.action)}`}>
                {actionLabel(e.action)}
              </span>
              <span className="text-sm font-medium">{e.actor_name}</span>
              <span className="text-xs text-muted-foreground">· {e.entity_type}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5 truncate">{e.summary}</p>
          </div>
          <span className="text-xs text-muted-foreground font-mono whitespace-nowrap shrink-0">
            {formatDateTime(e.created_at)}
          </span>
        </div>
      ))}
    </div>
  );
}
