import Link from 'next/link';
import type { RecentLog } from '@/lib/queries/dashboard';

const ACTION_CONFIG: Record<
  string,
  { label: string; badge: string; dot: string }
> = {
  create:        { label: 'Added',    badge: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-400' },
  update:        { label: 'Updated',  badge: 'bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-400',                 dot: 'bg-sky-400' },
  status_change: { label: 'Status',   badge: 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400',     dot: 'bg-indigo-400' },
  share:         { label: 'Shared',   badge: 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400',         dot: 'bg-amber-400' },
  convert:       { label: 'Mandate',  badge: 'bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-400',     dot: 'bg-violet-400' },
  delete:        { label: 'Removed',  badge: 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400',             dot: 'bg-rose-400' },
  delete_log:    { label: 'Log Del.', badge: 'bg-muted text-muted-foreground',   dot: 'bg-muted-foreground/40' },
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

type Group = { label: string; items: RecentLog[] };

function groupLogs(logs: RecentLog[]): Group[] {
  const now = new Date();
  const todayStr = now.toDateString();
  const yestStr = new Date(now.getTime() - 86_400_000).toDateString();

  const map = new Map<string, RecentLog[]>();
  for (const log of logs) {
    const d = new Date(log.created_at).toDateString();
    const label = d === todayStr ? 'Today' : d === yestStr ? 'Yesterday' : 'Earlier';
    map.set(label, [...(map.get(label) ?? []), log]);
  }

  return (['Today', 'Yesterday', 'Earlier'] as const)
    .filter((l) => map.has(l))
    .map((label) => ({ label, items: map.get(label)! }));
}

function ActivityRow({ log }: { log: RecentLog }) {
  const ac = ACTION_CONFIG[log.action] ?? {
    label: log.action,
    badge: 'bg-muted text-muted-foreground',
    dot: 'bg-muted-foreground/40',
  };
  const href =
    log.entity_type === 'asset' ? `/capital-markets/assets/${log.entity_id}` : null;
  const initial = (log.actor?.full_name ?? '?')[0].toUpperCase();

  return (
    <div className="flex items-start gap-3 py-2.5">
      {/* Actor avatar with action color dot */}
      <div className="relative shrink-0 mt-0.5">
        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-foreground/70">
          {initial}
        </div>
        <span
          className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-card ${ac.dot}`}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {href ? (
          <Link
            href={href}
            className="text-xs font-medium text-foreground hover:text-indigo-500 transition-colors leading-snug block truncate"
          >
            {log.summary}
          </Link>
        ) : (
          <p className="text-xs text-foreground/90 leading-snug truncate">{log.summary}</p>
        )}
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {log.actor?.full_name ?? 'System'}
          <span className="text-border mx-1">·</span>
          {relativeTime(log.created_at)}
        </p>
      </div>

      {/* Action badge */}
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${ac.badge}`}>
        {ac.label}
      </span>
    </div>
  );
}

export function RecentActivityWidget({ logs }: { logs: RecentLog[] }) {
  const groups = groupLogs(logs);

  return (
    <div className="border border-border rounded-xl bg-card shadow-sm p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Recent Activity
        </h2>
        <Link
          href="/capital-markets/logs"
          className="text-[11px] font-semibold text-indigo-500 hover:text-indigo-700 transition-colors"
        >
          View all →
        </Link>
      </div>

      {logs.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-8">No activity recorded yet.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-border">
          {/* Left column — first group or all on mobile */}
          <div className="lg:pr-5">
            {groups.map((group, gi) => {
              const colLogs = gi === 0 ? group.items.slice(0, 5) : [];
              if (colLogs.length === 0 && gi !== 0) return null;
              return (
                <div key={group.label}>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-1 pt-1">
                    {group.label}
                  </p>
                  <div className="divide-y divide-border">
                    {(gi === 0 ? colLogs : group.items).map((log) => (
                      <ActivityRow key={log.id} log={log} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right column — overflow logs on lg+ */}
          {logs.length > 5 && (
            <div className="hidden lg:block lg:pl-5">
              {(() => {
                const overflowLogs = logs.slice(5);
                const overflowGroups = groupLogs(overflowLogs);
                return overflowGroups.map((group) => (
                  <div key={group.label}>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-1 pt-1">
                      {group.label}
                    </p>
                    <div className="divide-y divide-border">
                      {group.items.map((log) => (
                        <ActivityRow key={log.id} log={log} />
                      ))}
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
