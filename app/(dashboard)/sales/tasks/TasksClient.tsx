'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  completeFollowUpTask,
  snoozeFollowUpTask,
  type FollowUpTaskRow,
} from '@/lib/actions/sales/follow-up-tasks';
import { istTodayISO, istDateISO, IST_TZ } from '@/lib/utils/formatters';

const TASK_TYPE_LABELS: Record<string, string> = {
  follow_up_call:         'Follow-up Call',
  revisit_reminder:       'Revisit Reminder',
  pre_visit_confirmation: 'Pre-visit Confirm',
  post_visit_update:      'Post-visit Update',
  custom:                 'Custom',
};

const TASK_TYPE_ICONS: Record<string, string> = {
  follow_up_call:         '📞',
  revisit_reminder:       '🔁',
  pre_visit_confirmation: '✅',
  post_visit_update:      '📝',
  custom:                 '📌',
};

const STATUS_STYLE: Record<string, { bg: string; color: string; border: string; label: string }> = {
  pending:   { bg: 'white',                      color: 'var(--sales-txt)',    border: 'var(--sales-border)',  label: 'Pending' },
  missed:    { bg: 'var(--status-lost-bg)',       color: 'var(--status-lost)',  border: 'var(--status-lost-border)', label: 'Overdue' },
  snoozed:   { bg: 'var(--status-warm-bg)',       color: 'var(--status-warm)',  border: 'var(--status-warm-border)', label: 'Snoozed' },
  completed: { bg: 'var(--status-booked-bg)',     color: 'var(--status-booked)',border: 'var(--status-booked-border)', label: 'Done' },
};

function formatDue(dueAt: string): string {
  const due = new Date(dueAt);
  const todayStr = istTodayISO();
  const dueStr = istDateISO(dueAt);
  const time = due.toLocaleTimeString('en-IN', { timeZone: IST_TZ, hour: '2-digit', minute: '2-digit', hour12: true });

  if (dueStr === todayStr) return `Today ${time}`;
  if (dueStr === istDateISO(Date.now() + 86400000)) return `Tomorrow ${time}`;
  return due.toLocaleDateString('en-IN', { timeZone: IST_TZ, day: 'numeric', month: 'short' }) + ' ' + time;
}

function isOverdue(dueAt: string, status: string): boolean {
  return status !== 'snoozed' && new Date(dueAt) < new Date();
}

function TaskCard({ task }: { task: FollowUpTaskRow }) {
  const router = useRouter();
  const [completing, startComplete] = useTransition();
  const [snoozing, startSnooze] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showSnoozeMenu, setShowSnoozeMenu] = useState(false);

  const overdue = isOverdue(task.due_at, task.status);
  const statusStyle = overdue && task.status === 'pending'
    ? STATUS_STYLE.missed
    : (STATUS_STYLE[task.status] ?? STATUS_STYLE.pending);

  function complete() {
    setError(null);
    startComplete(async () => {
      const res = await completeFollowUpTask(task.id);
      if (!res.ok) { setError(res.error); return; }
      router.refresh();
    });
  }

  function snooze(minutes: number) {
    setShowSnoozeMenu(false);
    setError(null);
    const snoozedUntil = new Date(Date.now() + minutes * 60000).toISOString();
    startSnooze(async () => {
      const res = await snoozeFollowUpTask({ task_id: task.id, snoozed_until: snoozedUntil });
      if (!res.ok) { setError(res.error); return; }
      router.refresh();
    });
  }

  const pending = completing || snoozing;

  return (
    <div style={{
      background: statusStyle.bg, border: `1px solid ${statusStyle.border}`,
      borderRadius: 10, padding: '14px 16px',
      borderLeft: overdue && task.status !== 'snoozed' ? `4px solid var(--status-lost)` : `1px solid ${statusStyle.border}`,
      opacity: pending ? 0.6 : 1, transition: 'opacity .15s',
      position: 'relative',
    }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        {/* Icon */}
        <div style={{
          width: 36, height: 36, borderRadius: 8, background: 'white',
          border: '1px solid var(--sales-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, flexShrink: 0,
        }}>
          {TASK_TYPE_ICONS[task.task_type] ?? '📌'}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--sales-txt)', marginBottom: 3 }}>
                {task.client_name ?? task.client_mobile ?? 'Unknown Client'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--sales-txt2)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span>{TASK_TYPE_LABELS[task.task_type] ?? task.task_type}</span>
                {task.client_mobile && task.client_name && (
                  <span>📱 {task.client_mobile}</span>
                )}
                {task.cp_name && <span>🏢 {task.cp_name}</span>}
              </div>
            </div>

            {/* Due time + status */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
              <span style={{
                padding: '3px 9px', borderRadius: 20,
                background: statusStyle.bg, color: statusStyle.color,
                border: `1px solid ${statusStyle.border}`,
                fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
              }}>
                {statusStyle.label}
              </span>
              <span style={{
                fontSize: 11, fontWeight: 600,
                color: overdue ? 'var(--status-lost)' : 'var(--sales-txt3)',
              }}>
                {formatDue(task.due_at)}
              </span>
            </div>
          </div>

          {task.notes && (
            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--sales-txt2)', fontStyle: 'italic' }}>
              {task.notes}
            </div>
          )}

          {task.status === 'snoozed' && task.snoozed_until && (
            <div style={{ marginTop: 4, fontSize: 11, color: 'var(--status-warm)' }}>
              Snoozed until {formatDue(task.snoozed_until)}
              {task.snooze_count > 0 && ` (×${task.snooze_count})`}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={complete}
              disabled={pending}
              style={{
                height: 30, padding: '0 14px', borderRadius: 6,
                border: '1px solid var(--status-booked)', background: 'transparent',
                color: 'var(--status-booked)', fontSize: 11, fontWeight: 700,
                cursor: pending ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sales)',
                opacity: pending ? 0.5 : 1,
              }}
            >
              ✓ Done
            </button>

            {/* Snooze button with dropdown */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowSnoozeMenu(p => !p)}
                disabled={pending}
                style={{
                  height: 30, padding: '0 12px', borderRadius: 6,
                  border: '1px solid var(--sales-border)', background: 'transparent',
                  color: 'var(--sales-txt2)', fontSize: 11, fontWeight: 700,
                  cursor: pending ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sales)',
                  opacity: pending ? 0.5 : 1,
                }}
              >
                ⏰ Snooze ▾
              </button>
              {showSnoozeMenu && (
                <div style={{
                  position: 'absolute', top: 34, left: 0, zIndex: 10,
                  background: 'white', border: '1px solid var(--sales-border)',
                  borderRadius: 8, boxShadow: 'var(--shadow-md)',
                  minWidth: 140, overflow: 'hidden',
                }}>
                  {[
                    { label: '1 hour', minutes: 60 },
                    { label: '2 hours', minutes: 120 },
                    { label: 'Tomorrow 9am', minutes: (() => {
                      const t = new Date();
                      t.setDate(t.getDate() + 1);
                      t.setHours(9, 0, 0, 0);
                      return Math.round((t.getTime() - Date.now()) / 60000);
                    })() },
                  ].map(opt => (
                    <button
                      key={opt.label}
                      onClick={() => snooze(opt.minutes)}
                      style={{
                        display: 'block', width: '100%', padding: '10px 14px',
                        background: 'none', border: 'none', textAlign: 'left',
                        fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        color: 'var(--sales-txt2)', fontFamily: 'var(--font-sales)',
                      }}
                      onMouseEnter={e => { (e.target as HTMLElement).style.background = 'var(--sales-bg)'; }}
                      onMouseLeave={e => { (e.target as HTMLElement).style.background = 'none'; }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {error && (
            <div style={{ marginTop: 6, fontSize: 11, color: 'var(--status-lost)' }}>{error}</div>
          )}
        </div>
      </div>
    </div>
  );
}

interface GroupedTasks {
  overdue: FollowUpTaskRow[];
  today: FollowUpTaskRow[];
  tomorrow: FollowUpTaskRow[];
  upcoming: FollowUpTaskRow[];
  snoozed: FollowUpTaskRow[];
}

export function TasksClient({ tasks }: { tasks: FollowUpTaskRow[] }) {
  const now = new Date();
  const todayStr = istTodayISO();
  const tomorrowStr = istDateISO(now.getTime() + 86400000);

  const grouped: GroupedTasks = { overdue: [], today: [], tomorrow: [], upcoming: [], snoozed: [] };

  for (const t of tasks) {
    if (t.status === 'snoozed') {
      grouped.snoozed.push(t);
      continue;
    }
    const dateStr = istDateISO(t.due_at);
    if (t.due_at < now.toISOString()) {
      grouped.overdue.push(t);
    } else if (dateStr === todayStr) {
      grouped.today.push(t);
    } else if (dateStr === tomorrowStr) {
      grouped.tomorrow.push(t);
    } else {
      grouped.upcoming.push(t);
    }
  }

  const sections: { key: string; label: string; tasks: FollowUpTaskRow[]; accent: string }[] = [
    { key: 'overdue', label: 'Overdue', tasks: grouped.overdue, accent: 'var(--status-lost)' },
    { key: 'today', label: 'Today', tasks: grouped.today, accent: 'var(--anex-navy)' },
    { key: 'tomorrow', label: 'Tomorrow', tasks: grouped.tomorrow, accent: 'var(--anex-teal)' },
    { key: 'upcoming', label: 'Upcoming', tasks: grouped.upcoming, accent: 'var(--sales-txt3)' },
    { key: 'snoozed', label: 'Snoozed', tasks: grouped.snoozed, accent: 'var(--status-warm)' },
  ].filter(s => s.tasks.length > 0);

  if (sections.length === 0) {
    return (
      <div style={{
        background: 'white', borderRadius: 12, border: '1px solid var(--sales-border)',
        padding: 48, textAlign: 'center', color: 'var(--sales-txt3)', fontSize: 14,
      }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>🎉</div>
        All caught up! No pending follow-up tasks.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {sections.map(section => (
        <div key={section.key}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{
              fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.4px',
              color: section.accent,
            }}>
              {section.label}
            </span>
            <div style={{ flex: 1, height: 1, background: 'var(--sales-border-light)' }} />
            <span style={{ fontSize: 11, color: 'var(--sales-txt3)' }}>
              {section.tasks.length} task{section.tasks.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {section.tasks.map(t => <TaskCard key={t.id} task={t} />)}
          </div>
        </div>
      ))}
    </div>
  );
}
