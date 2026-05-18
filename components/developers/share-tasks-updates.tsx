'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Plus, Trash2, Circle, CheckCircle2, Clock, User, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  completeShareTask,
  uncompleteShareTask,
  updateShareTaskFields,
  createShareTask,
  createShareUpdate,
  deleteShareUpdate,
} from '@/lib/actions/developers';
import { formatDate, formatTimeAgo } from '@/lib/utils/formatters';
import type { ShareTask, ShareUpdate } from '@/lib/queries/developers';
import type { TeamMemberSelect } from '@/lib/queries/team';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PRIORITY_DOT: Record<string, string> = {
  low:    'bg-slate-300',
  medium: 'bg-amber-400',
  high:   'bg-orange-500',
  urgent: 'bg-red-600',
};

// ─── Task row ─────────────────────────────────────────────────────────────────

function TaskRow({
  task,
  members,
}: {
  task: ShareTask;
  members: TeamMemberSelect[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const done = task.status === 'done';

  function handleComplete() {
    if (done) return;
    startTransition(async () => {
      await completeShareTask(task.id, task.share_id, task.task_type, task.title);
      router.refresh();
    });
  }

  function handleUndo() {
    startTransition(async () => {
      await uncompleteShareTask(task.id);
      router.refresh();
    });
  }

  function handleAssigneeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value || null;
    startTransition(async () => {
      await updateShareTaskFields(task.id, { assigned_to: val });
      router.refresh();
    });
  }

  function handleDueDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value || null;
    startTransition(async () => {
      await updateShareTaskFields(task.id, { due_date: val });
      router.refresh();
    });
  }

  return (
    <div className={`flex items-start gap-3 py-2.5 group/task ${isPending ? 'opacity-60' : ''}`}>
      {/* Checkbox */}
      <button
        onClick={handleComplete}
        disabled={done || isPending}
        className={`mt-0.5 shrink-0 transition-colors ${
          done
            ? 'text-emerald-500 cursor-default'
            : 'text-muted-foreground/30 hover:text-emerald-400'
        }`}
        aria-label={done ? 'Completed' : 'Mark complete'}
      >
        {done ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : (
          <Circle className="h-4 w-4" />
        )}
      </button>

      {/* Title + priority dot */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${PRIORITY_DOT[task.priority] ?? 'bg-slate-300'}`} />
          <span className={`text-sm leading-snug ${done ? 'line-through text-muted-foreground' : ''}`}>
            {task.title}
          </span>
        </div>
        {done && task.completed_at && (
          <p className="text-[10px] text-emerald-600 mt-0.5 pl-3.5">
            Completed {formatDate(task.completed_at)}
          </p>
        )}
      </div>

      {/* Assignee + due date (only when not done) */}
      {!done && (
        <div className="flex items-center gap-2 shrink-0">
          <select
            value={task.assigned_to ?? ''}
            onChange={handleAssigneeChange}
            disabled={isPending}
            className="h-6 rounded-md border bg-background px-1.5 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 cursor-pointer"
          >
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.full_name}</option>
            ))}
          </select>
          <input
            type="date"
            value={task.due_date ?? ''}
            onChange={handleDueDateChange}
            disabled={isPending}
            className="h-6 rounded-md border bg-background px-1.5 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
          />
        </div>
      )}

      {/* Done row: assignee name + undo button */}
      {done && (
        <div className="flex items-center gap-2 shrink-0">
          {task.assigned_to_name && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <User className="h-3 w-3" />{task.assigned_to_name}
            </span>
          )}
          <button
            onClick={handleUndo}
            disabled={isPending}
            className="opacity-0 group-hover/task:opacity-100 transition-opacity text-muted-foreground/40 hover:text-amber-600 disabled:pointer-events-none"
            aria-label="Undo completion"
            title="Undo"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Add task form ────────────────────────────────────────────────────────────

function AddTaskForm({
  shareId,
  members,
  onClose,
}: {
  shareId: string;
  members: TeamMemberSelect[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    if (!title.trim()) { setError('Title is required'); return; }
    startTransition(async () => {
      const result = await createShareTask(shareId, {
        title: title.trim(),
        priority: 'medium',
        assigned_to: assignedTo || null,
        due_date: dueDate || null,
      });
      if (result.ok) {
        onClose();
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="mt-2 rounded-lg border bg-muted/30 p-3 flex flex-col gap-2">
      <Input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onClose(); }}
        placeholder="Task title…"
        className="h-7 text-xs"
      />
      <div className="flex gap-2">
        <select
          value={assignedTo}
          onChange={(e) => setAssignedTo(e.target.value)}
          className="h-6 flex-1 rounded-md border bg-background px-1.5 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">Unassigned</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
        </select>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="h-6 rounded-md border bg-background px-1.5 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" className="h-6 px-3 text-xs" onClick={handleSave} disabled={isPending}>
          <Check className="h-3 w-3 mr-1" />Add
        </Button>
        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={onClose} disabled={isPending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ─── Update chain ─────────────────────────────────────────────────────────────

function UpdateEntry({ update, onDelete }: { update: ShareUpdate; onDelete: (id: string) => void }) {
  const isAutomatic = update.source === 'task_completed';
  return (
    <div className="flex items-start gap-2.5 group">
      <div className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 bg-muted-foreground/30 group-hover:bg-muted-foreground/60 transition-colors" />
      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-snug ${isAutomatic ? 'text-muted-foreground italic' : ''}`}>
          {update.body}
        </p>
        <p className="text-[10px] text-muted-foreground/60 mt-0.5">
          {update.created_by_name} · {formatTimeAgo(update.created_at)}
        </p>
      </div>
      {!isAutomatic && (
        <button
          onClick={() => onDelete(update.id)}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/40 hover:text-destructive mt-0.5"
          aria-label="Delete update"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

function AddUpdateForm({ shareId, onClose }: { shareId: string; onClose: () => void }) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    if (!body.trim()) { setError('Update cannot be empty'); return; }
    startTransition(async () => {
      const result = await createShareUpdate(shareId, { body: body.trim() });
      if (result.ok) { onClose(); router.refresh(); }
      else setError(result.error);
    });
  }

  return (
    <div className="mt-2 flex flex-col gap-2">
      <Textarea
        autoFocus
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSave(); } if (e.key === 'Escape') onClose(); }}
        placeholder="Add a note… (Enter to save)"
        className="text-xs resize-none min-h-[64px]"
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" className="h-6 px-3 text-xs" onClick={handleSave} disabled={isPending}>
          <Check className="h-3 w-3 mr-1" />Save
        </Button>
        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={onClose} disabled={isPending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function ShareTasksUpdates({
  shareId,
  tasks,
  updates,
  members,
}: {
  shareId: string;
  tasks: ShareTask[];
  updates: ShareUpdate[];
  members: TeamMemberSelect[];
}) {
  const router = useRouter();
  const [addingTask, setAddingTask] = useState(false);
  const [addingUpdate, setAddingUpdate] = useState(false);
  const [isPending, startTransition] = useTransition();

  const openTasks = tasks.filter((t) => t.status !== 'done');
  const doneTasks = tasks.filter((t) => t.status === 'done');

  function handleDeleteUpdate(updateId: string) {
    startTransition(async () => {
      await deleteShareUpdate(updateId, shareId);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-0 mt-3 border-t pt-3">
      {/* Tasks section */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tasks</p>
          {!addingTask && (
            <button
              onClick={() => setAddingTask(true)}
              className="text-[10px] text-muted-foreground/60 hover:text-primary transition-colors flex items-center gap-0.5"
            >
              <Plus className="h-3 w-3" />Add
            </button>
          )}
        </div>

        <div className="divide-y divide-border/50">
          {tasks.length === 0 && !addingTask && (
            <p className="text-xs text-muted-foreground/50 py-2 italic">No tasks yet</p>
          )}
          {/* Open tasks first */}
          {openTasks.map((t) => (
            <TaskRow key={t.id} task={t} members={members} />
          ))}
          {/* Done tasks at bottom */}
          {doneTasks.map((t) => (
            <TaskRow key={t.id} task={t} members={members} />
          ))}
        </div>

        {addingTask && (
          <AddTaskForm shareId={shareId} members={members} onClose={() => setAddingTask(false)} />
        )}
      </div>

      {/* Updates chain */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Updates</p>
          {!addingUpdate && (
            <button
              onClick={() => setAddingUpdate(true)}
              className="text-[10px] text-muted-foreground/60 hover:text-primary transition-colors flex items-center gap-0.5"
            >
              <Plus className="h-3 w-3" />Add
            </button>
          )}
        </div>

        {updates.length === 0 && !addingUpdate ? (
          <p className="text-xs text-muted-foreground/50 italic">
            No updates yet — completed tasks will appear here automatically
          </p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {updates.map((u) => (
              <UpdateEntry key={u.id} update={u} onDelete={handleDeleteUpdate} />
            ))}
          </div>
        )}

        {addingUpdate && (
          <AddUpdateForm shareId={shareId} onClose={() => setAddingUpdate(false)} />
        )}
      </div>
    </div>
  );
}
