'use client';

import { useState, useTransition, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ReactGridLayout, { useContainerWidth, verticalCompactor } from 'react-grid-layout';
import type { Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { Trash2, CheckCircle2, Circle, AlertCircle, Clock, Ban, ExternalLink, Pencil, Link as LinkIcon, Search, GripVertical, RotateCcw, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { TASK_PRIORITY_LABELS, TASK_PRIORITY_COLORS } from '@/lib/enums/task';
import { formatTimeAgo, formatDate, istTodayISO } from '@/lib/utils/formatters';
import { createUpdate } from '@/lib/actions/updates';
import { deleteUpdate } from '@/lib/actions/updates';
import { createTask, updateTaskStatus, updateTaskAssignee, setTaskFileUrl, deleteTask } from '@/lib/actions/tasks';
import { formatDate as _formatDate } from '@/lib/utils/formatters';
import type { UpdateWithAuthor, ActivityLogEntry } from '@/lib/queries/updates';
import type { TaskWithAssignee } from '@/lib/queries/tasks';
import type { ShareWithDetails } from '@/lib/queries/developers';
import type { TeamMemberOption } from '@/lib/queries/tasks';
import type { TaskPriority, TaskStatus } from '@/lib/schemas/task';

type Props = {
  assetId: string;
  currentUserId: string;
  updates: UpdateWithAuthor[];
  tasks: TaskWithAssignee[];
  activity: ActivityLogEntry[];
  shares: ShareWithDetails[];
  teamMembers: TeamMemberOption[];
  isClosed?: boolean;
};

const LAYOUT_KEY = 'anex:asset-panels-layout:v1';
const SHARES_SORT_KEY = 'anex:asset-shares-sort:v1';

const DEFAULT_LAYOUT: Layout = [
  { i: 'updates',  x: 0, y: 0,  w: 1, h: 11, minW: 1, minH: 6 },
  { i: 'tasks',    x: 1, y: 0,  w: 1, h: 9,  minW: 1, minH: 5 },
  { i: 'activity', x: 0, y: 11, w: 1, h: 5,  minW: 1, minH: 4 },
  { i: 'shares',   x: 1, y: 9,  w: 1, h: 5,  minW: 1, minH: 3 },
];

function PanelShell({ title, count, actions, children, chatMode }: {
  title: string; count?: number; actions?: React.ReactNode; children: React.ReactNode; chatMode?: boolean;
}) {
  return (
    <div className="rounded-lg border flex flex-col h-full min-h-0 overflow-hidden bg-card">
      <div className="panel-drag-handle flex items-center gap-2 px-4 py-2.5 border-b bg-muted/30 shrink-0 cursor-grab active:cursor-grabbing select-none">
        <span title="Drag to rearrange · Drag corner to resize" className="shrink-0 flex">
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40" />
        </span>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
        {count !== undefined && (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium">{count}</span>
        )}
        {actions && (
          <div
            className="ml-auto flex items-center gap-1 cursor-default"
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {actions}
          </div>
        )}
      </div>
      <div className={chatMode ? 'flex flex-col flex-1 min-h-0 overflow-hidden' : 'flex-1 overflow-y-auto'}>
        {children}
      </div>
    </div>
  );
}

// ─── Updates panel ────────────────────────────────────────────────────────────

function todayIso(): string {
  return istTodayISO();
}

function UpdateCard({ update, currentUserId, onDelete }: {
  update: UpdateWithAuthor; currentUserId: string; onDelete: (id: string) => void;
}) {
  const isOwn = update.created_by === currentUserId;
  const isOptimistic = update.id.startsWith('optimistic-');
  const authorName = update.author?.full_name ?? (isOwn ? 'You' : 'Unknown');
  const initial = authorName[0].toUpperCase();
  const isStructured = !!update.update_task;

  return (
    <div className={`group rounded-md border bg-card flex flex-col overflow-hidden transition-opacity ${isOptimistic ? 'opacity-60' : 'opacity-100'}`}>
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/40">
        <div className="h-5 w-5 rounded-full bg-foreground/85 flex items-center justify-center text-[9px] font-bold text-background shrink-0">
          {initial}
        </div>
        <span className="text-xs font-semibold text-foreground flex-1 truncate">{authorName}</span>
        {update.update_date && (
          <span className="text-[11px] font-medium text-muted-foreground shrink-0 bg-background border px-1.5 py-0.5 rounded">
            {formatDate(update.update_date)}
          </span>
        )}
        <span className="text-[11px] text-muted-foreground/70 shrink-0">
          {isOptimistic ? 'Logging…' : formatTimeAgo(update.created_at)}
        </span>
        {isOwn && !isOptimistic && (
          <button
            onClick={() => onDelete(update.id)}
            className="opacity-0 group-hover:opacity-100 text-muted-foreground/60 hover:text-rose-500 transition-opacity shrink-0"
            title="Delete"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>

      <div className="px-3 py-2.5 flex flex-col gap-1.5">
        {isStructured ? (
          <>
            <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">
              {update.update_task}
            </p>
            {update.comment && (
              <p className="text-[11px] text-muted-foreground leading-relaxed border-l-2 border-border pl-2.5 italic">
                {update.comment}
              </p>
            )}
          </>
        ) : (
          <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap">{update.body}</p>
        )}
      </div>
    </div>
  );
}

function UpdatesPanel({ assetId, currentUserId, updates, teamMembers, disabled = false }: {
  assetId: string;
  currentUserId: string;
  updates: UpdateWithAuthor[];
  teamMembers: TeamMemberOption[];
  disabled?: boolean;
}) {
  const [updateDate, setUpdateDate] = useState(todayIso);
  const [updateTask, setUpdateTask] = useState('');
  const [comment, setComment] = useState('');
  const [search, setSearch] = useState('');
  const [, startTransition] = useTransition();
  const router = useRouter();

  const [optimistic, setOptimistic] = useState<UpdateWithAuthor[]>([]);
  useEffect(() => { setOptimistic([]); }, [updates]);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  const currentUserName = teamMembers.find((m) => m.id === currentUserId)?.full_name ?? 'You';

  const all = [...updates, ...optimistic].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  const filtered = all.filter((u) => {
    if (hiddenIds.has(u.id)) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      u.body.toLowerCase().includes(q) ||
      (u.update_task ?? '').toLowerCase().includes(q) ||
      (u.comment ?? '').toLowerCase().includes(q) ||
      (u.author?.full_name ?? '').toLowerCase().includes(q)
    );
  });

  function submit() {
    const task = updateTask.trim();
    if (!task) return;

    const tempId = `optimistic-${Date.now()}`;
    const commentVal = comment.trim() || null;
    const tempMsg: UpdateWithAuthor = {
      id: tempId,
      asset_id: assetId,
      body: commentVal ? `${task}\n${commentVal}` : task,
      update_date: updateDate,
      update_task: task,
      comment: commentVal,
      created_at: new Date().toISOString(),
      created_by: currentUserId,
      author: { full_name: currentUserName },
      deleted_at: null,
      deleted_by: null,
    };

    setOptimistic((prev) => [...prev, tempMsg]);
    setUpdateTask('');
    setComment('');
    setUpdateDate(todayIso());

    startTransition(async () => {
      const result = await createUpdate(assetId, {
        update_date: updateDate,
        update_task: task,
        comment: comment.trim() || undefined,
      });
      if (result.ok) {
        router.refresh();
      } else {
        setOptimistic((prev) => prev.filter((m) => m.id !== tempId));
        setUpdateTask(task);
        setComment(comment);
      }
    });
  }

  function handleDelete(updateId: string) {
    setHiddenIds((prev) => new Set([...prev, updateId]));
    startTransition(async () => {
      const result = await deleteUpdate(updateId, assetId);
      if (result.ok) router.refresh();
      else setHiddenIds((prev) => { const n = new Set(prev); n.delete(updateId); return n; });
    });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="px-3 pt-2.5 pb-2 border-b shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search updates…"
            className="w-full pl-7 pr-3 h-7 text-xs border border-input rounded-md outline-none focus:border-ring bg-background placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* Log entries list — newest first */}
      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2 min-h-0">
        {filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center my-auto">
            {search ? 'No updates match your search.' : 'No updates yet. Log the first one below.'}
          </p>
        ) : (
          filtered.map((u) => (
            <UpdateCard key={u.id} update={u} currentUserId={currentUserId} onDelete={handleDelete} />
          ))
        )}
      </div>

      {/* Structured input form */}
      <div
        className={`border-t px-3 pt-3 pb-2.5 shrink-0 flex flex-col gap-2 bg-muted/20 transition-opacity ${
          disabled ? 'opacity-50 pointer-events-none select-none' : ''
        }`}
        aria-disabled={disabled || undefined}
      >
        {disabled && (
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground pb-1">
            <Lock className="h-3 w-3" />
            Closed prospect — reopen the asset to log updates.
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider w-16 shrink-0">Date</span>
          <input
            type="date"
            value={updateDate}
            onChange={(e) => setUpdateDate(e.target.value)}
            disabled={disabled}
            className="h-7 flex-1 rounded border border-input px-2 text-xs bg-background text-foreground outline-none focus:border-ring disabled:opacity-50 disabled:cursor-not-allowed [color-scheme:light] dark:[color-scheme:dark]"
          />
        </div>
        <div className="flex gap-2">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider w-16 shrink-0 pt-1.5">Update</span>
          <Textarea
            value={updateTask}
            onChange={(e) => setUpdateTask(e.target.value)}
            placeholder="What happened or needs to happen…"
            rows={2}
            disabled={disabled}
            className="text-xs resize-none flex-1 min-h-[48px]"
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); } }}
          />
        </div>
        <div className="flex gap-2">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider w-16 shrink-0 pt-1.5">Comment</span>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Additional context (optional)…"
            rows={1}
            disabled={disabled}
            className="text-xs resize-none flex-1 min-h-[32px]"
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); } }}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">⌘↵ to submit</span>
          <Button size="sm" onClick={submit} disabled={disabled || !updateTask.trim()} className="h-7 text-xs px-4">
            Log Update
          </Button>
        </div>
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

function TasksPanel({ assetId, tasks, teamMembers, currentUserId, disabled = false }: {
  assetId: string; tasks: TaskWithAssignee[]; teamMembers: TeamMemberOption[]; currentUserId: string; disabled?: boolean;
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

      {disabled && (
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground px-0.5">
          <Lock className="h-3 w-3" />
          Closed prospect — reopen the asset to add tasks.
        </div>
      )}
      <div
        className={`flex flex-wrap items-center gap-1.5 transition-opacity ${
          disabled ? 'opacity-50 pointer-events-none select-none' : ''
        }`}
        aria-disabled={disabled || undefined}
      >
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add task…"
          disabled={disabled}
          className="h-8 text-sm flex-1 min-w-[140px]"
          onKeyDown={(e) => { if (e.key === 'Enter') submitTask(); }} />
        <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}
          disabled={disabled}
          className="h-8 rounded-md border border-input bg-background px-1.5 text-xs shrink-0 disabled:opacity-50 disabled:cursor-not-allowed">
          {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{TASK_PRIORITY_LABELS[p]}</option>)}
        </select>
        <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}
          disabled={disabled}
          className="h-8 rounded-md border border-input bg-background px-1.5 text-xs shrink-0 max-w-[130px] disabled:opacity-50 disabled:cursor-not-allowed">
          <option value="">Assign to self</option>
          {teamMembers.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
        </select>
        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
          disabled={disabled}
          className="h-8 w-32 rounded-md border border-input bg-background px-1.5 text-xs shrink-0 disabled:opacity-50 disabled:cursor-not-allowed [color-scheme:light] dark:[color-scheme:dark]" />
        <Button size="sm" className="h-8 shrink-0" onClick={submitTask} disabled={disabled || !title.trim()}>Add</Button>
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

type ShareSort = 'newest' | 'oldest' | 'developer' | 'outcome' | 'shared_by';

const SHARE_SORT_OPTIONS: { value: ShareSort; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'developer', label: 'Developer A–Z' },
  { value: 'outcome', label: 'Outcome' },
  { value: 'shared_by', label: 'Shared by A–Z' },
];

// Won → Interested → Pursuing → Pending → Passed
const OUTCOME_RANK: Record<string, number> = {
  won: 0, interested: 1, pursuing: 2, pending: 3, passed: 4,
};

function sortShares(shares: ShareWithDetails[], sort: ShareSort): ShareWithDetails[] {
  const arr = [...shares];
  switch (sort) {
    case 'newest':
      return arr.sort((a, b) => new Date(b.shared_at).getTime() - new Date(a.shared_at).getTime());
    case 'oldest':
      return arr.sort((a, b) => new Date(a.shared_at).getTime() - new Date(b.shared_at).getTime());
    case 'developer':
      return arr.sort((a, b) => a.developer_name.localeCompare(b.developer_name));
    case 'shared_by':
      return arr.sort((a, b) => a.shared_by_name.localeCompare(b.shared_by_name));
    case 'outcome':
      return arr.sort((a, b) => {
        const ra = OUTCOME_RANK[a.outcome ?? 'pending'] ?? 99;
        const rb = OUTCOME_RANK[b.outcome ?? 'pending'] ?? 99;
        if (ra !== rb) return ra - rb;
        return new Date(b.shared_at).getTime() - new Date(a.shared_at).getTime();
      });
  }
}

function SharesSortDropdown({ value, onChange }: { value: ShareSort; onChange: (v: ShareSort) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as ShareSort)}
      aria-label="Sort developer shares"
      className="h-6 rounded border border-input bg-background px-1.5 text-[11px] outline-none focus:border-ring cursor-pointer"
    >
      {SHARE_SORT_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}

function SharesPanel({ shares, sort }: { shares: ShareWithDetails[]; sort: ShareSort }) {
  const sorted = useMemo(() => sortShares(shares, sort), [shares, sort]);
  if (sorted.length === 0) return <p className="text-xs text-muted-foreground text-center py-6 px-3">No shares yet.</p>;
  return (
    <div className="flex flex-col divide-y">
      {sorted.map((s) => {
        const lu = s.last_update;
        const isAuto = lu?.source === 'task_completed';
        return (
          <div key={s.id} className="flex items-start gap-3 px-3 py-2.5 hover:bg-muted/20">
            <div className="flex-1 min-w-0">
              <Link
                href={`/capital-markets/developers/${s.developer_id}`}
                className="text-sm font-medium truncate hover:underline underline-offset-2 block"
              >
                {s.developer_name}
              </Link>
              <p className="text-xs text-muted-foreground">by {s.shared_by_name} · {_formatDate(s.shared_at)}</p>
              {lu && (
                <div className="mt-1.5 rounded-md border bg-muted/40 px-2 py-1.5">
                  <p
                    className={`text-xs leading-snug line-clamp-2 ${isAuto ? 'text-muted-foreground italic' : 'text-foreground/90'}`}
                    title={lu.body}
                  >
                    {lu.body}
                  </p>
                  <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                    {lu.created_by_name} · {formatTimeAgo(lu.created_at)}
                  </p>
                </div>
              )}
            </div>
            <span className={`text-xs capitalize font-medium shrink-0 mt-0.5 ${OUTCOME_COLORS[s.outcome ?? ''] ?? 'text-muted-foreground'}`}>
              {s.outcome ?? 'Pending'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Root export ──────────────────────────────────────────────────────────────

export function DetailPanels({ assetId, currentUserId, updates, tasks, activity, shares, teamMembers, isClosed = false }: Props) {
  const openTasks = tasks.filter((t) => t.status !== 'done' && t.status !== 'cancelled').length;
  const { width, containerRef, mounted } = useContainerWidth();

  const [shareSort, setShareSort] = useState<ShareSort>('newest');
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SHARES_SORT_KEY);
      if (stored && SHARE_SORT_OPTIONS.some((opt) => opt.value === stored)) {
        setShareSort(stored as ShareSort);
      }
    } catch {}
  }, []);

  function handleShareSortChange(next: ShareSort) {
    setShareSort(next);
    try { localStorage.setItem(SHARES_SORT_KEY, next); } catch {}
  }

  const [layout, setLayout] = useState<Layout>(DEFAULT_LAYOUT);
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LAYOUT_KEY);
      if (stored) setLayout(JSON.parse(stored));
    } catch {}
  }, []);

  function handleLayoutChange(newLayout: Layout) {
    setLayout(newLayout);
    try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(newLayout)); } catch {}
  }

  function resetLayout() {
    setLayout(DEFAULT_LAYOUT);
    try { localStorage.removeItem(LAYOUT_KEY); } catch {}
  }

  return (
    <div className="relative group/panels">
      <button
        onClick={resetLayout}
        title="Reset layout"
        className="absolute -top-7 right-0 z-10 flex items-center gap-1 text-xs text-muted-foreground/50 hover:text-muted-foreground opacity-0 group-hover/panels:opacity-100 transition-all"
      >
        <RotateCcw className="h-3 w-3" />
        Reset
      </button>

      {isClosed && (
        <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50/70 dark:bg-rose-950/20 dark:border-rose-900 px-3.5 py-2.5">
          <Lock className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div className="flex flex-col gap-0.5">
            <p className="text-xs font-semibold text-rose-800 dark:text-rose-200">Closed prospect</p>
            <p className="text-[11px] text-rose-700/80 dark:text-rose-300/80 leading-snug">
              The developer passed on this asset. New updates and tasks are locked. Change the status away from <span className="font-medium">Dropped</span> to reopen.
            </p>
          </div>
        </div>
      )}

      <div ref={containerRef}>
        {mounted && (
          <ReactGridLayout
            layout={layout}
            width={width}
            gridConfig={{ cols: 2, rowHeight: 48, margin: [16, 16] }}
            dragConfig={{ enabled: true, handle: '.panel-drag-handle' }}
            resizeConfig={{ enabled: true, handles: ['se', 's'] }}
            compactor={verticalCompactor}
            onLayoutChange={handleLayoutChange}
          >
            <div key="updates" className="h-full">
              <PanelShell title="Updates" count={updates.length} chatMode>
                <UpdatesPanel assetId={assetId} currentUserId={currentUserId} updates={updates} teamMembers={teamMembers} disabled={isClosed} />
              </PanelShell>
            </div>
            <div key="tasks" className="h-full">
              <PanelShell title="Tasks" count={openTasks}>
                <TasksPanel assetId={assetId} tasks={tasks} teamMembers={teamMembers} currentUserId={currentUserId} disabled={isClosed} />
              </PanelShell>
            </div>
            <div key="activity" className="h-full">
              <PanelShell title="Activity" count={activity.length}>
                <ActivityPanel activity={activity} />
              </PanelShell>
            </div>
            <div key="shares" className="h-full">
              <PanelShell
                title="Developer Shares"
                count={shares.length}
                actions={<SharesSortDropdown value={shareSort} onChange={handleShareSortChange} />}
              >
                <SharesPanel shares={shares} sort={shareSort} />
              </PanelShell>
            </div>
          </ReactGridLayout>
        )}
      </div>
    </div>
  );
}
