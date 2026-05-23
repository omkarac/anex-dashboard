'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, CheckCircle2, Circle, AlertCircle, Clock, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ASSET_STATUS_LABELS } from '@/lib/enums/asset';
import { TASK_PRIORITY_LABELS, TASK_PRIORITY_COLORS } from '@/lib/enums/task';
import { formatTimeAgo, formatDate, istTodayISO } from '@/lib/utils/formatters';
import { createUpdate, deleteUpdate } from '@/lib/actions/updates';
import { createTask, updateTaskStatus, deleteTask } from '@/lib/actions/tasks';
import type { UpdateWithAuthor, StatusHistoryEntry, ActivityLogEntry } from '@/lib/queries/updates';
import type { TaskWithAssignee } from '@/lib/queries/tasks';
import type { TaskPriority, TaskStatus } from '@/lib/schemas/task';

type Props = {
  assetId: string;
  currentUserId: string;
  updates: UpdateWithAuthor[];
  tasks: TaskWithAssignee[];
  history: StatusHistoryEntry[];
  activity: ActivityLogEntry[];
};

function PanelShell({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border flex flex-col min-h-0">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/30 shrink-0">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
        {count !== undefined && (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium">
            {count}
          </span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}

// ─── Updates panel ────────────────────────────────────────────────────────────

function UpdatesPanel({
  assetId,
  currentUserId,
  updates,
}: {
  assetId: string;
  currentUserId: string;
  updates: UpdateWithAuthor[];
}) {
  const [body, setBody] = useState('');
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    if (!body.trim()) return;
    startTransition(async () => {
      const result = await createUpdate(assetId, {
        update_date: istTodayISO(),
        update_task: body.trim(),
      });
      if (result.ok) { setBody(''); router.refresh(); }
    });
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex gap-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write an update…"
          rows={2}
          className="text-sm resize-none"
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(); }}
        />
        <Button
          size="sm"
          onClick={submit}
          disabled={isPending || !body.trim()}
          className="shrink-0 self-end"
        >
          Post
        </Button>
      </div>

      {updates.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">No updates yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {updates.map((u) => (
            <UpdateCard key={u.id} update={u} assetId={assetId} currentUserId={currentUserId} />
          ))}
        </div>
      )}
    </div>
  );
}

function UpdateCard({
  update,
  assetId,
  currentUserId,
}: {
  update: UpdateWithAuthor;
  assetId: string;
  currentUserId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const canDelete = update.created_by === currentUserId;

  return (
    <div className="group rounded-md border p-2.5 text-sm flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium">{update.author?.full_name ?? 'Unknown'}</span>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">{formatTimeAgo(update.created_at)}</span>
          {canDelete && (
            <button
              onClick={() => startTransition(async () => { await deleteUpdate(update.id, assetId); router.refresh(); })}
              disabled={isPending}
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity disabled:opacity-40"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
      <p className="text-sm whitespace-pre-wrap">{update.body}</p>
    </div>
  );
}

// ─── Tasks panel ──────────────────────────────────────────────────────────────

const PRIORITY_OPTIONS: TaskPriority[] = ['low', 'medium', 'high', 'urgent'];

const STATUS_CYCLE: Record<TaskStatus, TaskStatus> = {
  todo: 'in_progress',
  in_progress: 'done',
  blocked: 'done',
  done: 'todo',
  cancelled: 'todo',
};

const STATUS_ICON: Record<TaskStatus, React.ReactNode> = {
  todo: <Circle className="h-3.5 w-3.5 text-muted-foreground" />,
  in_progress: <Clock className="h-3.5 w-3.5 text-blue-500" />,
  blocked: <AlertCircle className="h-3.5 w-3.5 text-red-500" />,
  done: <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />,
  cancelled: <Ban className="h-3.5 w-3.5 text-muted-foreground" />,
};

function TasksPanel({ assetId, tasks }: { assetId: string; tasks: TaskWithAssignee[] }) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function submitTask() {
    if (!title.trim()) return;
    startTransition(async () => {
      const result = await createTask(assetId, { title, priority, due_date: dueDate || null });
      if (result.ok) { setTitle(''); setDueDate(''); setPriority('medium'); router.refresh(); }
    });
  }

  return (
    <div className="flex flex-col gap-2 p-3">
      {/* Quick-add */}
      <div className="flex items-center gap-1.5">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add task…"
          className="h-8 text-sm"
          onKeyDown={(e) => { if (e.key === 'Enter') submitTask(); }}
        />
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as TaskPriority)}
          className="h-8 rounded-md border border-input bg-background px-1.5 text-xs shrink-0"
        >
          {PRIORITY_OPTIONS.map((p) => (
            <option key={p} value={p}>{TASK_PRIORITY_LABELS[p]}</option>
          ))}
        </select>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="h-8 w-32 rounded-md border border-input bg-background px-1.5 text-xs shrink-0"
        />
        <Button size="sm" className="h-8 shrink-0" onClick={submitTask} disabled={isPending || !title.trim()}>
          Add
        </Button>
      </div>

      {tasks.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">No tasks yet.</p>
      ) : (
        <div className="flex flex-col">
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} assetId={assetId} />
          ))}
        </div>
      )}
    </div>
  );
}

function TaskRow({ task, assetId }: { task: TaskWithAssignee; assetId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div
      className={`group flex items-center gap-2 rounded px-1.5 py-1.5 hover:bg-muted/30 transition-colors ${
        task.status === 'done' || task.status === 'cancelled' ? 'opacity-50' : ''
      }`}
    >
      <button
        onClick={() => startTransition(async () => { await updateTaskStatus(task.id, assetId, STATUS_CYCLE[task.status]); router.refresh(); })}
        disabled={isPending}
        className="shrink-0 disabled:opacity-40"
      >
        {STATUS_ICON[task.status]}
      </button>

      <span className={`flex-1 text-sm min-w-0 truncate ${task.status === 'done' ? 'line-through text-muted-foreground' : ''}`}>
        {task.title}
      </span>

      <span className={`text-xs shrink-0 ${TASK_PRIORITY_COLORS[task.priority]}`}>
        {TASK_PRIORITY_LABELS[task.priority]}
      </span>

      {task.due_date && (
        <span className={`text-xs shrink-0 ${new Date(task.due_date) < new Date() && task.status !== 'done' ? 'text-red-500' : 'text-muted-foreground'}`}>
          {formatDate(task.due_date)}
        </span>
      )}

      <button
        onClick={() => startTransition(async () => { await deleteTask(task.id, assetId); router.refresh(); })}
        disabled={isPending}
        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity shrink-0 disabled:opacity-40"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

// ─── History panel ────────────────────────────────────────────────────────────

function HistoryPanel({ history }: { history: StatusHistoryEntry[] }) {
  if (history.length === 0) {
    return <p className="text-xs text-muted-foreground text-center py-6 px-3">No changes yet.</p>;
  }

  return (
    <div className="flex flex-col p-3 gap-0">
      {history.map((entry, i) => (
        <div key={entry.id} className="flex gap-2.5">
          <div className="flex flex-col items-center">
            <div className="mt-1 h-2 w-2 rounded-full bg-border shrink-0" />
            {i < history.length - 1 && <div className="w-px flex-1 bg-border mt-1 mb-0" />}
          </div>
          <div className="pb-3 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1 text-xs">
              {entry.from_status && (
                <>
                  <span className="text-muted-foreground">{ASSET_STATUS_LABELS[entry.from_status]}</span>
                  <span className="text-muted-foreground">→</span>
                </>
              )}
              <span className="font-medium">{ASSET_STATUS_LABELS[entry.to_status]}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {entry.actor?.full_name ?? 'Unknown'} · {formatTimeAgo(entry.changed_at)}
            </p>
            {entry.note && (
              <p className="text-xs text-muted-foreground italic mt-0.5">"{entry.note}"</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Activity panel ───────────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  create: 'Created',
  update: 'Updated',
  delete: 'Deleted',
  status_change: 'Status',
  share: 'Shared',
  convert: 'Converted',
};

function ActivityPanel({ activity }: { activity: ActivityLogEntry[] }) {
  if (activity.length === 0) {
    return <p className="text-xs text-muted-foreground text-center py-6 px-3">No activity yet.</p>;
  }

  return (
    <div className="flex flex-col divide-y">
      {activity.map((log) => (
        <div key={log.id} className="flex items-start gap-2.5 px-3 py-2 hover:bg-muted/20 transition-colors">
          <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-xs font-medium shrink-0 mt-0.5">
            {(log.actor?.full_name ?? '?')[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs">{log.summary}</p>
            <p className="text-xs text-muted-foreground">{formatTimeAgo(log.created_at)}</p>
          </div>
          <span className="text-xs text-muted-foreground shrink-0">
            {ACTION_LABELS[log.action] ?? log.action}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Root export ──────────────────────────────────────────────────────────────

const TABS = ['Updates', 'Tasks', 'Shares', 'History', 'Activity'] as const;
type Tab = typeof TABS[number];

export function DetailTabs({ assetId, currentUserId, updates, tasks, history, activity }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('Updates');
  const openTasks = tasks.filter((t) => t.status !== 'done' && t.status !== 'cancelled').length;

  return (
    <div className="rounded-lg border flex flex-col min-h-[600px]">
      <div className="flex border-b overflow-x-auto shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab}
            {tab === 'Tasks' && openTasks > 0 && (
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs">{openTasks}</span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'Updates' && <UpdatesPanel assetId={assetId} currentUserId={currentUserId} updates={updates} />}
        {activeTab === 'Tasks' && <TasksPanel assetId={assetId} tasks={tasks} />}
        {activeTab === 'Shares' && (
          <p className="text-sm text-muted-foreground text-center py-8">Developer shares — coming in Slice 4.</p>
        )}
        {activeTab === 'History' && <HistoryPanel history={history} />}
        {activeTab === 'Activity' && <ActivityPanel activity={activity} />}
      </div>
    </div>
  );
}
