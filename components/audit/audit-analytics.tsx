import { actionLabel, actionColor } from '@/lib/enums/audit';
import { IST_TZ } from '@/lib/utils/formatters';
import type { AuditAnalytics } from '@/lib/queries/audit';

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border bg-card p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">{title}</h3>
      {children}
    </section>
  );
}

function TimeSeriesChart({ data }: { data: AuditAnalytics['timeSeries'] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="flex items-end gap-1.5 h-40">
      {data.map((d) => {
        const heightPct = (d.count / max) * 100;
        const label = new Date(d.date).toLocaleDateString('en-IN', { timeZone: IST_TZ, day: 'numeric', month: 'short' });
        return (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group" title={`${label}: ${d.count} events`}>
            <span className="text-[10px] text-muted-foreground tabular-nums opacity-0 group-hover:opacity-100 transition-opacity">
              {d.count}
            </span>
            <div className="w-full bg-muted rounded-sm flex items-end h-32">
              <div
                className="w-full bg-primary/70 group-hover:bg-primary rounded-sm transition-colors"
                style={{ height: `${Math.max(heightPct, d.count > 0 ? 4 : 0)}%` }}
              />
            </div>
            <span className="text-[9px] text-muted-foreground whitespace-nowrap rotate-0">{label.split(' ')[0]}</span>
          </div>
        );
      })}
    </div>
  );
}

function ActionBreakdown({ data }: { data: AuditAnalytics['actions'] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  if (data.length === 0) return <p className="text-xs text-muted-foreground">No events.</p>;
  return (
    <div className="space-y-2">
      {data.map((d) => (
        <div key={d.action} className="flex items-center gap-2">
          <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium w-24 justify-center shrink-0 ${actionColor(d.action)}`}>
            {actionLabel(d.action)}
          </span>
          <div className="flex-1 h-5 bg-muted rounded overflow-hidden">
            <div className="h-full bg-primary/60 rounded" style={{ width: `${(d.count / max) * 100}%` }} />
          </div>
          <span className="text-xs tabular-nums text-muted-foreground w-10 text-right">{d.count}</span>
        </div>
      ))}
    </div>
  );
}

function Leaderboard({ data }: { data: AuditAnalytics['leaderboard'] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  if (data.length === 0) return <p className="text-xs text-muted-foreground">No active users.</p>;
  return (
    <div className="space-y-2">
      {data.map((d, i) => (
        <div key={d.actor_id} className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-4 tabular-nums">{i + 1}</span>
          <span className="text-xs font-medium w-32 truncate shrink-0" title={d.full_name}>{d.full_name}</span>
          <div className="flex-1 h-5 bg-muted rounded overflow-hidden">
            <div className="h-full bg-emerald-500/60 rounded" style={{ width: `${(d.count / max) * 100}%` }} />
          </div>
          <span className="text-xs tabular-nums text-muted-foreground w-10 text-right">{d.count}</span>
        </div>
      ))}
    </div>
  );
}

export function AuditAnalyticsView({ analytics }: { analytics: AuditAnalytics }) {
  return (
    <div className="space-y-4">
      <Panel title={`Activity — last 14 days (${analytics.totalEvents} events in view)`}>
        <TimeSeriesChart data={analytics.timeSeries} />
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Events by action">
          <ActionBreakdown data={analytics.actions} />
        </Panel>
        <Panel title="Most active users">
          <Leaderboard data={analytics.leaderboard} />
        </Panel>
      </div>
    </div>
  );
}
