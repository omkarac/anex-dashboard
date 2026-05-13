'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Trash2, CheckCircle2, Circle, AlertCircle, Clock, Ban, ExternalLink, Pencil, Link as LinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ASSET_STATUS_LABELS } from '@/lib/enums/asset';
import { TASK_PRIORITY_LABELS, TASK_PRIORITY_COLORS } from '@/lib/enums/task';
import { formatTimeAgo, formatDate } from '@/lib/utils/formatters';
import { createUpdate, deleteUpdate } from '@/lib/actions/updates';
import { createTask, updateTaskStatus, updateTaskAssignee, setTaskFileUrl, deleteTask } from '@/lib/actions/tasks';
import { formatDate as _formatDate } from '@/lib/utils/formatters';
import type { UpdateWithAuthor, StatusHistoryEntry, ActivityLogEntry } from '@/lib/queries/updates';
import type { TaskWithAssignee } from '@/lib/queries/tasks';
import type { ShareWithDetails } from '@/lib/queries/developers';
import type { TeamMemberOption } from '@/lib/queries/tasks';
import type { TaskPriority, TaskStatus } from '@/lib/schemas/task';

type Props = {
  assetId: string;
  currentUserId: string;
  updates: UpdateWithAuthor[];
  tasks: TaskWithAssignee[];
  history: StatusHistoryEntry[];
  activity: ActivityLogEntry[];
  shares: ShareWithDetails[];
  teamMembers: TeamMemberOption[];
};

function PanelShell({ title, count, children, chatMode }: {
  title: string; count?: number; children: React.ReactNode; chatMode?: boolean;
}) {
  return (
    <div className="rounded-lg border flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/30 shrink-0">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
        {count !== undefined && (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium">{count}</span>
        )}
      </div>
      <div className={chatMode ? 'flex flex-col flex-1 min-h-0 overflow-hidden' : 'flex-1 overflow-y-auto'}>
        {children}
      </div>
    </div>
  );
}

// ─── Updates panel ────────────────────────────────────────────────────────────

function UpdatesPanel({ assetId, currentUserId, updates }: {
  assetId: string; currentUserId: string; updates: UpdateWithAuthor[];
}) {
  const [body, setBody] = useState('');
  const [, startTransition] = useTransition();
  const router = useRouter();
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Optimistic messages — cleared when server data arrives
  const [optimistic, setOptimistic] = useState<UpdateWithAuthor[]>([]);
  useEffect(() => { setOptimistic([]); }, [updates]);

  const sorted = [...updates, ...optimistic].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sorted.length]);

  // Optimistically hidden IDs (pending delete)
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  function submit() {
    const text = body.trim();
    if (!text) return;

    // Add to local list immediately
    const tempId = `optimistic-${Date.now()}`;
    const tempMsg: UpdateWithAuthor = {
      id: tempId,
      asset_id: assetId,
      body: text,
      created_at: new Date().toISOString(),
      created_by: currentUserId,
      author: null,
      deleted_at: null,
      deleted_by: null,
    };
    setOptimistic((prev) => [...prev, tempMsg]);
    setBody('');
    textareaRef.current?.focus();

    startTransition(async () => {
      const result = await createUpdate(assetId, text);
      if (result.ok) {
        router.refresh(); // syncs in background; useEffect clears optimistic
      } else {
        setOptimistic((prev) => prev.filter((m) => m.id !== tempId));
        setBody(text); // restore on failure
      }
    });
  }

  function handleDelete(updateId: string) {
    setHiddenIds((prev) => new Set([...prev, updateId])); // hide immediately
    startTransition(async () => {
      const result = await deleteUpdate(updateId, assetId);
      if (result.ok) {
        router.refresh();
      } else {
        setHiddenIds((prev) => { const n = new Set(prev); n.delete(updateId); return n; }); // restore on failure
      }
    });
  }

  const visible = sorted.filter((u) => !hiddenIds.has(u.id));

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2 min-h-0">
        {visible.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center my-auto">No updates yet. Start the conversation.</p>
        ) : (
          visible.map((u) => (
            <UpdateBubble key={u.id} update={u} currentUserId={currentUserId} onDelete={handleDelete} />
          ))
        )}
        <div ref={bottomRef} />
      </div>
      <div className="border-t px-3 py-2.5 shrink-0 flex gap-2 items-end bg-background">
        <Textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write an update… (⌘↵ to send)"
          rows={1}
          className="text-sm resize-none flex-1 min-h-[36px] max-h-[120px]"
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); } }}
        />
        <Button size="sm" onClick={submit} disabled={!body.trim()} className="shrink-0 h-9">Send</Button>
      </div>
    </div>
  );
}

function UpdateBubble({ update, currentUserId, onDelete }: {
  update: UpdateWithAuthor; currentUserId: string; onDelete: (id: string) => void;
}) {
  const isOwn = update.created_by === currentUserId;
  const isOptimistic = update.id.startsWith('optimistic-');

  return (
    <div className={`group flex flex-col gap-0.5 max-w-[80%] transition-opacity ${isOptimistic ? 'opacity-60' : 'opacity-100'} ${isOwn ? 'self-end items-end' : 'self-start items-start'}`}>
      {!isOwn && (
        <span className="text-xs text-muted-foreground px-1">{update.author?.full_name ?? 'Unknown'}</span>
      )}
      <div className={`rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words ${isOwn ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted text-foreground rounded-bl-sm'}`}>
        {update.body}
      </div>
      <div className={`flex items-center gap-1.5 px-1 ${isOwn ? 'flex-row-reverse' : ''}`}>
        {!isOptimistic && <span className="text-xs text-muted-foreground">{formatTimeAgo(update.created_at)}</span>}
        {isOptimistic && <span className="text-xs text-muted-foreground italic">Sending…</span>}
        {isOwn && !isOptimistic && (
          <button
            onClick={() => onDelete(update.id)}
            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Tasks panel ──────────────────────────────────────────────────────────────

const PRIORITY_OPTIONS: TaskPriority[] = ['low', 'medium', 'high', 'urgent'];

const STATUS_CYCLE: Record<TaskStatus, TaskStatus> = {
  todo: 'in_progress', in_progress: 'done', blocked: 'done', done: 'todo', cancelled: 'todo',
};

const STATUS_ICON: Record<TaskStatus, React.ReactNode> = {
  todo:       <Circle       className="h-3.5 w-3.5 text-muted-foreground" />,
  in_progress:<Clock        className="h-3.5 w-3.5 text-blue-500" />,
  blocked:    <AlertCircle  className="h-3.5 w-3.5 text-red-500" />,
  done:       <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />,
  cancelled:  <Ban          className="h-3.5 w-3.5 text-muted-foreground" />,
};

// MilestoneRow with optimistic done toggle
function MilestoneRow({ task, assetId, teamMembers }: {
  task: TaskWithAssignee; assetId: string; teamMembers: TeamMemberOption[];
}) {
  const [, startTransition] = useTransition();
  const router = useRouter();

  const [localDone, setLocalDone] = useState(task.status === 'done');
  const [localFileUrl, setLocalFileUrl] = useState(task.file_url ?? null);
  const [localAssignee, setLocalAssignee] = useState(task.assigned_to ?? '');

  // Sync from server when props change
  useEffect(() => { setLocalDone(task.status === 'done'); }, [task.status]);
  useEffect(() => { setLocalFileUrl(task.file_url ?? null); }, [task.file_url]);
  useEffect(() => { setLocalAssignee(task.assigned_to ?? ''); }, [task.assigned_to]);

  const [prompting, setPrompting] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const [editingUrl, setEditingUrl] = useState(false);
  const [editUrlDraft, setEditUrlDraft] = useState('');

  function startComplete() {
    if (localDone) {
      setLocalDone(false);
      startTransition(async () => {
        const result = await updateTaskStatus(task.id, assetId, 'todo');
        if (!result.ok) setLocalDone(true);
        else router.refresh();
      });
    } else {
      setUrlDraft('');
      setPrompting(true);
    }
  }

  function confirmComplete(fileUrl: string | null) {
    setLocalDone(true);
    setLocalFileUrl(fileUrl);
    setPrompting(false);
    startTransition(async () => {
      const result = await updateTaskStatus(task.id, assetId, 'done', fileUrl);
      if (!result.ok) { setLocalDone(false); setLocalFileUrl(task.file_url ?? null); }
      else router.refresh();
    });
  }

  function saveEditedUrl() {
    const url = editUrlDraft.trim() || null;
    setLocalFileUrl(url);
    setEditingUrl(false);
    startTransition(async () => {
      const result = await setTaskFileUrl(task.id, assetId, url);
      if (!result.ok) setLocalFileUrl(task.file_url ?? null);
      else router.refresh();
    });
  }

  function reassign(memberId: string) {
    setLocalAssignee(memberId);
    startTransition(async () => {
      const result = await updateTaskAssignee(task.id, assetId, memberId || null);
      if (!result.ok) setLocalAssignee(task.assigned_to ?? '');
      else router.refresh();
    });
  }

  return (
    <div className={`flex flex-col gap-2 px-3 py-2.5 rounded-lg border transition-colors ${localDone ? 'bg-green-50 border-green-100 dark:bg-green-950/20 dark:border-green-900' : 'bg-card border-border'}`}>
      <div className="flex items-center gap-3">
        <button onClick={startComplete} disabled={prompting} className="shrink-0">
          {localDone
            ? <CheckCircle2 className="h-5 w-5 text-green-500" />
            : <Circle className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors" />}
        </button>

        <span className={`flex-1 text-sm font-medium ${localDone ? 'text-muted-foreground' : ''}`}>
          {task.title}
        </span>

        {localDone && !editingUrl && (
          localFileUrl ? (
            <div className="flex items-center gap-1 shrink-0">
              <a href={localFileUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline transition-colors">
                <ExternalLink className="h-3 w-3" />Open file
              </a>
              <button onClick={() => { setEditUrlDraft(localFileUrl ?? ''); setEditingUrl(true); }}
                className="text-muted-foreground hover:text-foreground transition-colors ml-1">
                <Pencil className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <button onClick={() => { setEditUrlDraft(''); setEditingUrl(true); }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0 flex items-center gap-1">
              <LinkIcon className="h-3 w-3" />Add file link
            </button>
          )
        )}

        <select value={localAssignee} onChange={(e) => reassign(e.target.value)}
          className="h-7 rounded-md border border-input bg-background px-1.5 text-xs shrink-0 max-w-[130px]">
          <option value="">Unassigned</option>
          {teamMembers.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
        </select>
      </div>

      {prompting && (
        <div className="flex flex-col gap-2 pl-8">
          <p className="text-xs text-muted-foreground">Paste the SharePoint link for this file (optional)</p>
          <div className="flex gap-1.5">
            <Input autoFocus placeholder="https://company.sharepoint.com/…" value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') confirmComplete(urlDraft.trim() || null); if (e.key === 'Escape') setPrompting(false); }}
              className="h-7 text-xs flex-1" />
            <Button size="sm" className="h-7 text-xs px-2.5" onClick={() => confirmComplete(urlDraft.trim() || null)}>Done</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => setPrompting(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {editingUrl && (
        <div className="flex gap-1.5 pl-8">
          <Input autoFocus placeholder="https://company.sharepoint.com/…" value={editUrlDraft}
            onChange={(e) => setEditUrlDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') saveEditedUrl(); if (e.key === 'Escape') setEditingUrl(false); }}
            className="h-7 text-xs flex-1" />
          <Button size="sm" className="h-7 text-xs px-2.5" onClick={saveEditedUrl}>Save</Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => setEditingUrl(false)}>Cancel</Button>
        </div>
      )}
    </div>
  );
}

// TaskRow with optimistic status toggle
function TaskRow({ task, assetId }: { task: TaskWithAssignee; assetId: string }) {
  const [, startTransition] = useTransition();
  const router = useRouter();

  const [localStatus, setLocalStatus] = useState(task.status);
  useEffect(() => { setLocalStatus(task.status); }, [task.status]);

  // Optimistically hidden (pending delete)
  const [deleted, setDeleted] = useState(false);

  function toggle() {
    const next = STATUS_CYCLE[localStatus];
    setLocalStatus(next);
    startTransition(async () => {
      const result = await updateTaskStatus(task.id, assetId, next);
      if (!result.ok) setLocalStatus(task.status);
      else router.refresh();
    });
  }

  function remove() {
    setDeleted(true);
    startTransition(async () => {
      const result = await deleteTask(task.id, assetId);
      if (!result.ok) setDeleted(false);
      else router.refresh();
    });
  }

  if (deleted) return null;

  return (
    <div className={`group flex items-center gap-2 rounded px-1.5 py-1.5 hover:bg-muted/30 transition-colors ${localStatus === 'done' || localStatus === 'cancelled' ? 'opacity-50' : ''}`}>
      <button onClick={toggle} className="shrink-0">{STATUS_ICON[localStatus]}</button>

      <span className={`flex-1 text-sm min-w-0 truncate ${localStatus === 'done' ? 'line-through text-muted-foreground' : ''}`}>
        {task.title}
      </span>

      {task.assignee && (
        <span className="text-xs text-muted-foreground shrink-0 max-w-[80px] truncate">
          {task.assignee.full_name.split(' ')[0]}
        </span>
      )}

      <span className={`text-xs shrink-0 ${TASK_PRIORITY_COLORS[task.priority]}`}>
        {TASK_PRIORITY_LABELS[task.priority]}
      </span>

      {task.due_date && (
        <span className={`text-xs shrink-0 ${new Date(task.due_date) < new Date() && localStatus !== 'done' ? 'text-red-500' : 'text-muted-foreground'}`}>
          {formatDate(task.due_date)}
        </span>
      )}

      <button onClick={remove}
        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity shrink-0">
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

function TasksPanel({ assetId, tasks, teamMembers, currentUserId }: {
  assetId: string; tasks: TaskWithAssignee[]; teamMembers: TeamMemberOption[]; currentUserId: string;
}) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [, startTransition] = useTransition();
  const router = useRouter();

  // Optimistic new tasks
  const [optimisticTasks, setOptimisticTasks] = useState<TaskWithAssignee[]>([]);
  useEffect(() => { setOptimisticTasks([]); }, [tasks]);

  const milestones = tasks.filter((t) => t.is_milestone);
  const openTasks = [...tasks.filter((t) => !t.is_milestone && t.status !== 'done' && t.status !== 'cancelled'), ...optimisticTasks];
  const completedTasks = tasks.filter((t) => !t.is_milestone && (t.status === 'done' || t.status === 'cancelled'));

  function submitTask() {
    const text = title.trim();
    if (!text) return;

    const tempTask: TaskWithAssignee = {
      id: `optimistic-${Date.now()}`,
      asset_id: assetId,
      title: text,
      description: null,
      status: 'todo',
      priority,
      assigned_to: assignedTo || currentUserId,
      due_date: dueDate || null,
      completed_at: null,
      file_url: null,
      is_milestone: false,
      created_at: new Date().toISOString(),
      created_by: currentUserId,
      updated_at: new Date().toISOString(),
      deleted_at: null,
      deleted_by: null,
      assignee: null,
    };

    setOptimisticTasks((prev) => [...prev, tempTask]);
    setTitle(''); setDueDate(''); setPriority('medium'); setAssignedTo('');

    startTransition(async () => {
      const result = await createTask(assetId, { title: text, priority, due_date: dueDate || null, assigned_to: assignedTo || currentUserId });
      if (result.ok) router.refresh();
      else setOptimisticTasks((prev) => prev.filter((t) => t.id !== tempTask.id));
    });
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      {milestones.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-0.5">Key Milestones</p>
          {milestones.map((t) => <MilestoneRow key={t.id} task={t} assetId={assetId} teamMembers={teamMembers} />)}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add task…"
          className="h-8 text-sm flex-1 min-w-[140px]"
          onKeyDown={(e) => { if (e.key === 'Enter') submitTask(); }} />
        <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}
          className="h-8 rounded-md border border-input bg-background px-1.5 text-xs shrink-0">
          {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{TASK_PRIORITY_LABELS[p]}</option>)}
        </select>
        <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-1.5 text-xs shrink-0 max-w-[130px]">
          <option value="">Assign to self</option>
          {teamMembers.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
        </select>
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
          className="h-8 w-32 rounded-md border border-input bg-background px-1.5 text-xs shrink-0" />
        <Button size="sm" className="h-8 shrink-0" onClick={submitTask} disabled={!title.trim()}>Add</Button>
      </div>

      {openTasks.length === 0 && milestones.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-2">No tasks yet.</p>
      )}
      {openTasks.length > 0 && (
        <div className="flex flex-col">
          {openTasks.map((task) => (
            <TaskRow key={task.id} task={task} assetId={assetId} />
          ))}
        </div>
      )}

      {completedTasks.length > 0 && (
        <div className="flex flex-col gap-1 pt-1 border-t">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-0.5 pt-1">Completed</p>
          <div className="flex flex-col gap-1.5">
            {completedTasks.map((task) => (
              <div key={task.id} className="self-end flex flex-col items-end gap-0.5 max-w-[85%]">
                <div className="rounded-2xl rounded-br-sm bg-green-100 dark:bg-green-900/30 px-3 py-1.5 text-sm text-green-800 dark:text-green-200 line-through">
                  {task.title}
                </div>
                <span className="text-xs text-muted-foreground px-1">
                  {task.assignee?.full_name ?? 'Someone'} · {task.completed_at ? formatTimeAgo(task.completed_at) : 'completed'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── History panel ────────────────────────────────────────────────────────────

function HistoryPanel({ history }: { history: StatusHistoryEntry[] }) {
  if (history.length === 0) return <p className="text-xs text-muted-foreground text-center py-6 px-3">No changes yet.</p>;
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
                <><span className="text-muted-foreground">{ASSET_STATUS_LABELS[entry.from_status]}</span><span className="text-muted-foreground">→</span></>
              )}
              <span className="font-medium">{ASSET_STATUS_LABELS[entry.to_status]}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {entry.actor?.full_name ?? 'Unknown'} · {formatTimeAgo(entry.changed_at)}
            </p>
            {entry.note && <p className="text-xs text-muted-foreground italic mt-0.5">"{entry.note}"</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Activity panel ───────────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  create: 'Created', update: 'Updated', delete: 'Deleted',
  status_change: 'Status', share: 'Shared', convert: 'Converted',
};

function ActivityPanel({ activity }: { activity: ActivityLogEntry[] }) {
  if (activity.length === 0) return <p className="text-xs text-muted-foreground text-center py-6 px-3">No activity yet.</p>;
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
          <span className="text-xs text-muted-foreground shrink-0">{ACTION_LABELS[log.action] ?? log.action}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Shares panel ─────────────────────────────────────────────────────────────

const OUTCOME_COLORS: Record<string, string> = {
  interested: 'text-green-700', pursuing: 'text-blue-700', passed: 'text-gray-500', won: 'text-emerald-700',
};

function SharesPanel({ shares }: { shares: ShareWithDetails[] }) {
  if (shares.length === 0) return <p className="text-xs text-muted-foreground text-center py-6 px-3">No shares yet.</p>;
  return (
    <div className="flex flex-col divide-y">
      {shares.map((s) => (
        <div key={s.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/20">
          <div className="flex-1 min-w-0">
            <Link
              href={`/capital-markets/developers/${s.developer_id}`}
              className="text-sm font-medium truncate hover:underline underline-offset-2 block"
            >
              {s.developer_name}
            </Link>
            <p className="text-xs text-muted-foreground">by {s.shared_by_name} · {_formatDate(s.shared_at)}</p>
          </div>
          <span className={`text-xs capitalize font-medium shrink-0 ${OUTCOME_COLORS[s.outcome ?? ''] ?? 'text-muted-foreground'}`}>
            {s.outcome ?? 'Pending'}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Root export ──────────────────────────────────────────────────────────────

export function DetailPanels({ assetId, currentUserId, updates, tasks, history, activity, shares, teamMembers }: Props) {
  const openTasks = tasks.filter((t) => t.status !== 'done' && t.status !== 'cancelled').length;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="flex flex-col" style={{ height: '480px' }}>
        <PanelShell title="Updates" count={updates.length} chatMode>
          <UpdatesPanel assetId={assetId} currentUserId={currentUserId} updates={updates} />
        </PanelShell>
      </div>
      <div className="flex flex-col" style={{ maxHeight: '480px' }}>
        <PanelShell title="Tasks" count={openTasks}>
          <TasksPanel assetId={assetId} tasks={tasks} teamMembers={teamMembers} currentUserId={currentUserId} />
        </PanelShell>
      </div>
      <div className="flex flex-col" style={{ maxHeight: '300px' }}>
        <PanelShell title="History" count={history.length}>
          <HistoryPanel history={history} />
        </PanelShell>
      </div>
      <div className="flex flex-col" style={{ maxHeight: '300px' }}>
        <PanelShell title="Activity" count={activity.length}>
          <ActivityPanel activity={activity} />
        </PanelShell>
      </div>
      <div className="md:col-span-2" style={{ maxHeight: '280px' }}>
        <PanelShell title="Developer Shares" count={shares.length}>
          <SharesPanel shares={shares} />
        </PanelShell>
      </div>
    </div>
  );
}
