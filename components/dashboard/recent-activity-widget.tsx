import Link from 'next/link';
import { formatTimeAgo } from '@/lib/utils/formatters';
import type { RecentLog } from '@/lib/queries/dashboard';

const ACTION_CONFIG: Record<string, { label: string; classes: string }> = {
  create:        { label: 'Added',    classes: 'text-emerald-700 bg-emerald-50' },
  update:        { label: 'Updated',  classes: 'text-sky-700 bg-sky-50' },
  status_change: { label: 'Status',   classes: 'text-indigo-700 bg-indigo-50' },
  share:         { label: 'Shared',   classes: 'text-amber-700 bg-amber-50' },
  convert:       { label: 'Mandate',  classes: 'text-violet-700 bg-violet-50' },
  delete:        { label: 'Removed',  classes: 'text-rose-700 bg-rose-50' },
  delete_log:    { label: 'Log Del.', classes: 'text-slate-500 bg-slate-100' },
};

function ActivityRow({ log }: { log: RecentLog }) {
  const ac = ACTION_CONFIG[log.action] ?? { label: log.action, classes: 'text-slate-500 bg-slate-100' };
  const href = log.entity_type === 'asset' ? `/capital-markets/assets/${log.entity_id}` : null;

  return (
    <div className="flex items-start gap-3 py-3">
      <div className="h-6 w-6 rounded-full bg-slate-900 flex items-center justify-center text-[10px] font-semibold text-white shrink-0 mt-0.5">
        {(log.actor?.full_name ?? '?')[0].toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        {href ? (
          <Link
            href={href}
            className="text-xs font-medium text-slate-900 hover:text-indigo-700 transition-colors leading-snug block"
          >
            {log.summary}
          </Link>
        ) : (
          <p className="text-xs text-slate-800 leading-snug">{log.summary}</p>
        )}
        <p className="text-[11px] text-slate-400 mt-0.5">
          {log.actor?.full_name ?? 'System'} · {formatTimeAgo(log.created_at)}
        </p>
      </div>
      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 mt-0.5 ${ac.classes}`}>
        {ac.label}
      </span>
    </div>
  );
}

export function RecentActivityWidget({ logs }: { logs: RecentLog[] }) {
  const left = logs.slice(0, 5);
  const right = logs.slice(5);

  return (
    <div className="border rounded-md p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-400">
          Recent Activity
        </h2>
        <Link
          href="/capital-markets/logs"
          className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          View all →
        </Link>
      </div>

      {logs.length === 0 ? (
        <p className="text-xs text-slate-400 text-center py-6">No activity recorded yet.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
          <div className="flex flex-col divide-y divide-slate-100 lg:pr-5">
            {left.map((log) => <ActivityRow key={log.id} log={log} />)}
          </div>
          {right.length > 0 && (
            <div className="flex flex-col divide-y divide-slate-100 lg:pl-5">
              {right.map((log) => <ActivityRow key={log.id} log={log} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
