import Link from 'next/link';
import { formatDate } from '@/lib/utils/formatters';
import { actionLabel, actionColor, VERTICAL_SHORT, VERTICAL_COLORS } from '@/lib/enums/audit';
import { verticalForEntity, type LogEntry } from '@/lib/queries/logs';

function timeOfDay(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function groupByDay(logs: LogEntry[]): { day: string; items: LogEntry[] }[] {
  const map = new Map<string, LogEntry[]>();
  for (const log of logs) {
    const key = log.created_at.slice(0, 10);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(log);
  }
  return [...map.entries()].map(([day, items]) => ({ day, items }));
}

export function AuditTimeline({ logs }: { logs: LogEntry[] }) {
  if (logs.length === 0) {
    return (
      <div className="rounded-lg border">
        <p className="text-sm text-muted-foreground text-center py-12">No audit events match these filters.</p>
      </div>
    );
  }

  const groups = groupByDay(logs);

  return (
    <div className="space-y-6">
      {groups.map(({ day, items }) => (
        <section key={day}>
          <div className="flex items-center gap-3 mb-3">
            <h3 className="text-sm font-semibold">{formatDate(day)}</h3>
            <span className="text-xs text-muted-foreground">{items.length} event{items.length !== 1 ? 's' : ''}</span>
            <div className="flex-1 border-t" />
          </div>

          <ol className="relative border-l ml-2 space-y-3">
            {items.map((log) => {
              const vert = verticalForEntity(log.entity_type);
              return (
                <li key={log.id} className="ml-4">
                  <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-primary/60 border border-background" />
                  <div className="flex items-start gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground font-mono w-16 shrink-0">{timeOfDay(log.created_at)}</span>
                    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold ${VERTICAL_COLORS[vert]}`}>
                      {VERTICAL_SHORT[vert]}
                    </span>
                    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium ${actionColor(log.action)}`}>
                      {actionLabel(log.action)}
                    </span>
                    <span className="text-sm flex-1 min-w-[200px]">
                      <span className="font-medium">{log.actor?.full_name ?? 'System'}</span>
                      <span className="text-muted-foreground"> — {log.summary}</span>
                      {log.asset && (
                        <>
                          {' '}
                          <Link href={`/capital-markets/assets/${log.asset.id}`} className="text-primary hover:underline font-medium">
                            {log.asset.property_name}
                          </Link>
                        </>
                      )}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
