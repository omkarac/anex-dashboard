'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { X, Zap } from 'lucide-react';
import { updateShareTaskFields } from '@/lib/actions/developers';
import type { UnassignedTask } from '@/lib/queries/developers';
import type { TeamMemberSelect } from '@/lib/queries/team';

export function UnassignedFAB({
  tasks,
  members,
}: {
  tasks: UnassignedTask[];
  members: TeamMemberSelect[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const [assigning, setAssigning] = useState<string | null>(null);

  if (tasks.length === 0) return null;

  function assign(taskId: string, memberId: string) {
    setAssigning(taskId);
    startTransition(async () => {
      await updateShareTaskFields(taskId, { assigned_to: memberId });
      setAssigning(null);
      router.refresh();
    });
  }

  return (
    <div className="fixed bottom-8 right-8 z-50 flex flex-col items-end gap-3">
      {/* Slide-up drawer */}
      {open && (
        <div className="dev-drawer w-80 rounded-2xl border border-border bg-card/95 backdrop-blur-xl overflow-hidden shadow-2xl shadow-black/20 dark:shadow-black/50">
          {/* Header */}
          <div className="px-4 pt-4 pb-3 border-b border-border flex items-start justify-between">
            <div>
              <p className="text-[9px] font-bold tracking-[0.12em] uppercase text-primary mb-1">Needs Action</p>
              <p className="text-sm font-semibold tracking-tight">
                {tasks.length} unassigned {tasks.length === 1 ? 'task' : 'tasks'}
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="h-7 w-7 rounded-lg hover:bg-muted flex items-center justify-center transition-colors -mt-0.5 shrink-0"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>

          {/* Task rows */}
          <div className="divide-y divide-border max-h-[340px] overflow-y-auto">
            {tasks.map((t) => (
              <div key={t.id} className="px-4 py-3 flex items-center gap-3 hover:bg-muted/40 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{t.developer_name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {t.title} · {t.asset_name}
                  </p>
                </div>
                <select
                  defaultValue=""
                  disabled={assigning === t.id}
                  onChange={(e) => { if (e.target.value) assign(t.id, e.target.value); }}
                  className="h-7 shrink-0 rounded-md border border-border bg-background px-2 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 cursor-pointer"
                >
                  <option value="" disabled>Assign →</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>{m.full_name}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FAB button */}
      <div className="relative">
        {!open && <span className="dev-fab-ring absolute inset-0 rounded-full bg-primary" />}
        <button
          onClick={() => setOpen((o) => !o)}
          className="relative h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
          aria-label={open ? 'Close action tray' : `${tasks.length} tasks need assignment`}
        >
          <span
            className="transition-transform duration-300"
            style={{ transform: open ? 'rotate(135deg)' : 'rotate(0deg)' }}
          >
            {open ? <X className="h-5 w-5" /> : <Zap className="h-5 w-5" />}
          </span>
        </button>
        {!open && (
          <span className="dev-bdg absolute -top-1.5 -right-1.5 h-5 min-w-[20px] rounded-full bg-destructive text-white text-[10px] font-bold flex items-center justify-center px-1 shadow border-2 border-background">
            {tasks.length}
          </span>
        )}
      </div>
    </div>
  );
}
