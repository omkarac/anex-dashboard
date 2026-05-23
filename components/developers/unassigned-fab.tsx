'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { X, Zap, User } from 'lucide-react';
import { updateShareTaskFields } from '@/lib/actions/developers';
import { istTodayISO, IST_TZ } from '@/lib/utils/formatters';
import type { UnassignedTask, MyTask } from '@/lib/queries/developers';
import type { TeamMemberSelect } from '@/lib/queries/team';

// ─── Styles ───────────────────────────────────────────────────────────────────

const FAB_STYLES = `
  :root { --fab-c1:18,32,179; --fab-c2:40,60,210; }
  .dark  { --fab-c1:72,98,232; --fab-c2:110,140,255; }
  @keyframes fab-ring-out {
    0%   { transform:scale(1); opacity:0.65; }
    100% { transform:scale(2.4); opacity:0; }
  }
  @keyframes fab-throb {
    0%,100% { box-shadow:0 4px 18px rgba(var(--fab-c1),0.38), 0 0 0 0px rgba(var(--fab-c1),0.10); }
    50%     { box-shadow:0 8px 34px rgba(var(--fab-c2),0.62), 0 0 0 6px rgba(var(--fab-c1),0.12); }
  }
  .dev-fab-ring { animation:fab-ring-out 2s ease-out infinite; }
  .fab-throb    { animation:fab-throb 1.8s ease-in-out infinite; }
  .fab-throb:hover { animation-play-state:paused; }
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PRIORITY_DOT: Record<string, string> = {
  high:   'bg-destructive',
  medium: 'bg-amber-500',
  low:    'bg-muted-foreground/30',
};

const PRIORITY_LABEL: Record<string, string> = {
  high: 'High',
  medium: 'Med',
  low: 'Low',
};

const STATUS_LABEL: Record<string, string> = {
  todo:        'To Do',
  in_progress: 'In Progress',
};

const STATUS_CLS: Record<string, string> = {
  todo:        'text-muted-foreground/60',
  in_progress: 'text-blue-600 dark:text-blue-400',
};

function formatDue(due: string | null): { label: string; overdue: boolean } | null {
  if (!due) return null;
  const today = istTodayISO();
  const overdue = due < today;
  const d = new Date(due);
  const label = d.toLocaleDateString('en-IN', { timeZone: IST_TZ, day: 'numeric', month: 'short' });
  return { label, overdue };
}

// ─── Unassigned task row ──────────────────────────────────────────────────────

function UnassignedRow({
  task,
  members,
  assigning,
  onAssign,
}: {
  task: UnassignedTask;
  members: TeamMemberSelect[];
  assigning: string | null;
  onAssign: (taskId: string, memberId: string) => void;
}) {
  return (
    <div className="px-4 py-3 flex items-center gap-3 hover:bg-muted/40 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold truncate leading-tight">{task.title}</p>
        <p className="text-[10px] text-muted-foreground truncate mt-0.5">
          <span className="font-medium text-foreground/70">{task.developer_name}</span>
          <span className="mx-1 opacity-40">·</span>
          {task.asset_name}
        </p>
      </div>
      <select
        defaultValue=""
        disabled={assigning === task.id}
        onChange={(e) => { if (e.target.value) onAssign(task.id, e.target.value); }}
        className="h-7 shrink-0 rounded-md border border-border bg-background px-2 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 cursor-pointer"
      >
        <option value="" disabled>Assign →</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>{m.full_name}</option>
        ))}
      </select>
    </div>
  );
}

// ─── My task row ──────────────────────────────────────────────────────────────

function MyTaskRow({ task }: { task: MyTask }) {
  const due = formatDue(task.due_date);

  return (
    <Link
      href={task.link}
      className="block px-4 py-3 hover:bg-muted/40 transition-colors group/row"
    >
      <div className="flex items-start gap-2.5">
        {/* Priority dot */}
        <span className={`mt-1 h-2 w-2 rounded-full shrink-0 ${PRIORITY_DOT[task.priority] ?? 'bg-muted-foreground/30'}`} />
        <div className="flex-1 min-w-0">
          {/* Title + status */}
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-xs font-semibold truncate leading-tight group-hover/row:underline underline-offset-2">
              {task.title}
            </p>
            <span className={`text-[10px] font-medium shrink-0 ${STATUS_CLS[task.status] ?? 'text-muted-foreground/60'}`}>
              {STATUS_LABEL[task.status] ?? task.status}
            </span>
          </div>
          {/* Context row */}
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {task.source === 'share' && task.developer_name ? (
              <>
                <span className="text-[10px] text-muted-foreground font-medium truncate max-w-[90px]">
                  {task.developer_name}
                </span>
                <span className="text-muted-foreground/40 text-[10px]">·</span>
              </>
            ) : null}
            <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">
              {task.asset_name}
            </span>
            {due && (
              <>
                <span className="text-muted-foreground/40 text-[10px]">·</span>
                <span className={`text-[10px] font-medium ${due.overdue ? 'text-destructive' : 'text-muted-foreground/70'}`}>
                  {due.overdue ? 'Overdue · ' : ''}{due.label}
                </span>
              </>
            )}
          </div>
        </div>
        {/* Priority label */}
        <span className="text-[9px] font-bold tracking-wide text-muted-foreground/50 uppercase shrink-0 mt-0.5">
          {PRIORITY_LABEL[task.priority] ?? task.priority}
        </span>
      </div>
    </Link>
  );
}

// ─── Main FAB ─────────────────────────────────────────────────────────────────

export function UnassignedFAB({
  tasks,
  myTasks,
  members,
}: {
  tasks: UnassignedTask[];
  myTasks: MyTask[];
  members: TeamMemberSelect[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'unassigned' | 'mine'>(() =>
    tasks.length > 0 ? 'unassigned' : 'mine'
  );
  const [, startTransition] = useTransition();
  const [assigning, setAssigning] = useState<string | null>(null);

  if (tasks.length === 0 && myTasks.length === 0) return null;

  function assign(taskId: string, memberId: string) {
    setAssigning(taskId);
    startTransition(async () => {
      await updateShareTaskFields(taskId, { assigned_to: memberId });
      setAssigning(null);
      router.refresh();
    });
  }

  const hasUnassigned = tasks.length > 0;

  return (
    <div className="fixed bottom-8 right-8 z-50 flex flex-col items-end gap-3">
      <style>{FAB_STYLES}</style>

      {/* Slide-up drawer */}
      {open && (
        <div className="dev-drawer w-[340px] rounded-2xl border border-border bg-card/95 backdrop-blur-xl overflow-hidden shadow-2xl shadow-black/20 dark:shadow-black/50">

          {/* Header */}
          <div className="px-4 pt-4 pb-3 border-b border-border flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-bold tracking-[0.12em] uppercase text-primary mb-2">Action Required</p>
              {/* Tab toggle */}
              <div className="flex items-center gap-0.5 rounded-lg bg-muted/70 p-0.5">
                <button
                  onClick={() => setTab('unassigned')}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${tab === 'unassigned' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <Zap className="h-3 w-3 shrink-0" />
                  Unassigned
                  {tasks.length > 0 && (
                    <span className={`rounded-full min-w-[16px] h-4 px-1 text-[9px] font-bold flex items-center justify-center ${tab === 'unassigned' ? 'bg-destructive/15 text-destructive' : 'bg-muted text-muted-foreground'}`}>
                      {tasks.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setTab('mine')}
                  className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${tab === 'mine' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <User className="h-3 w-3 shrink-0" />
                  Mine
                  {myTasks.length > 0 && (
                    <span className={`rounded-full min-w-[16px] h-4 px-1 text-[9px] font-bold flex items-center justify-center ${tab === 'mine' ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}>
                      {myTasks.length}
                    </span>
                  )}
                </button>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="h-7 w-7 rounded-lg hover:bg-muted flex items-center justify-center transition-colors -mt-0.5 shrink-0"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>

          {/* Task list */}
          <div className="divide-y divide-border max-h-[360px] overflow-y-auto">
            {tab === 'unassigned' ? (
              tasks.length === 0 ? (
                <p className="px-4 py-8 text-center text-xs text-muted-foreground">All tasks assigned.</p>
              ) : (
                tasks.map((t) => (
                  <UnassignedRow
                    key={t.id}
                    task={t}
                    members={members}
                    assigning={assigning}
                    onAssign={assign}
                  />
                ))
              )
            ) : (
              myTasks.length === 0 ? (
                <p className="px-4 py-8 text-center text-xs text-muted-foreground">No open tasks assigned to you.</p>
              ) : (
                myTasks.map((t) => <MyTaskRow key={t.id} task={t} />)
              )
            )}
          </div>
        </div>
      )}

      {/* FAB button */}
      <div className="relative">
        {!open && hasUnassigned && <span className="dev-fab-ring absolute inset-0 rounded-full bg-primary" />}
        <button
          onClick={() => setOpen((o) => !o)}
          className={`relative h-14 w-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center transition-transform duration-200 hover:scale-105 active:scale-95 ${!open && hasUnassigned ? 'fab-throb' : 'shadow-lg shadow-primary/25'}`}
          aria-label={open ? 'Close action tray' : `${tasks.length} unassigned, ${myTasks.length} mine`}
        >
          <span
            className="transition-transform duration-300"
            style={{ transform: open ? 'rotate(135deg)' : 'rotate(0deg)' }}
          >
            {open ? <X className="h-5 w-5" /> : <Zap className="h-5 w-5" />}
          </span>
        </button>

        {/* Unassigned count badge (red) */}
        {!open && tasks.length > 0 && (
          <span className="dev-bdg absolute -top-1.5 -right-1.5 h-5 min-w-[20px] rounded-full bg-destructive text-white text-[10px] font-bold flex items-center justify-center px-1 shadow border-2 border-background">
            {tasks.length}
          </span>
        )}

        {/* My tasks count badge (primary, bottom-left) */}
        {!open && myTasks.length > 0 && (
          <span className="dev-bdg absolute -bottom-1.5 -left-1.5 h-5 min-w-[20px] rounded-full bg-primary/80 text-primary-foreground text-[10px] font-bold flex items-center justify-center px-1 shadow border-2 border-background">
            {myTasks.length}
          </span>
        )}
      </div>
    </div>
  );
}
