import Link from 'next/link';
import { formatTimeAgo } from '@/lib/utils/formatters';
import type { RecentLog } from '@/lib/queries/dashboard';

const ACTION_LABELS: Record<string, string> = {
  create: 'Created',
  update: 'Updated',
  delete: 'Deleted',
  status_change: 'Status',
  share: 'Shared',
  convert: 'Converted',
  delete_log: 'Del. Log',
};

const ENTITY_LINKS: Record<string, (id: string) => string | null> = {
  asset: (id) => `/capital-markets/assets/${id}`,
};

export function RecentActivityWidget({ logs }: { logs: RecentLog[] }) {
  return (
    <div className="rounded-lg border p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Recent Activity
        </h2>
        <Link href="/capital-markets/logs" className="text-xs text-primary hover:underline">
          View all
        </Link>
      </div>

      {logs.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">No activity yet.</p>
      ) : (
        <div className="flex flex-col divide-y">
          {logs.map((log) => {
            const linkFn = ENTITY_LINKS[log.entity_type];
            const href = linkFn ? linkFn(log.entity_id) : null;

            return (
              <div key={log.id} className="flex items-start gap-2.5 py-2">
                <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-xs font-medium shrink-0 mt-0.5">
                  {(log.actor?.full_name ?? '?')[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs leading-snug">{log.summary}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xs text-muted-foreground">{formatTimeAgo(log.created_at)}</span>
                    {href && (
                      <>
                        <span className="text-muted-foreground text-xs">·</span>
                        <Link href={href} className="text-xs text-primary hover:underline font-mono">
                          {log.entity_id.slice(0, 8)}…
                        </Link>
                      </>
                    )}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {ACTION_LABELS[log.action] ?? log.action}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
