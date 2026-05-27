'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Share2, Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { shareWithDeveloper } from '@/lib/actions/developers';
import type { DeveloperOption } from '@/lib/queries/developers';
import type { ShareWithDetails } from '@/lib/queries/developers';

const TASK_OPTIONS = [
  { type: 'im_shared',  label: 'Share Information Memorandum (IM)', dateLabel: 'IM share date' },
  { type: 'ff_shared',  label: 'Share Financial Feasibility (FF)',  dateLabel: 'FF share date' },
  { type: 'eoi_issued', label: 'Secure EOI',                        dateLabel: 'EOI date'      },
] as const;

type TaskType = (typeof TASK_OPTIONS)[number]['type'];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const OUTCOME_CONFIG: Record<string, { icon: React.ReactNode; className: string; label: string }> = {
  interested: { icon: <CheckCircle2 className="h-3 w-3" />, className: 'text-green-600', label: 'Interested' },
  pursuing:   { icon: <CheckCircle2 className="h-3 w-3" />, className: 'text-blue-600',  label: 'Pursuing'   },
  won:        { icon: <CheckCircle2 className="h-3 w-3" />, className: 'text-emerald-600', label: 'Won'       },
  passed:     { icon: <XCircle className="h-3 w-3" />,      className: 'text-gray-400',  label: 'Passed'     },
};

type Props = {
  assetId: string;
  developers: DeveloperOption[];
  existingShares: ShareWithDetails[];
};

export function ShareDialog({ assetId, developers, existingShares }: Props) {
  const [open, setOpen] = useState(false);
  const [developerId, setDeveloperId] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedTasks, setSelectedTasks] = useState<Set<TaskType>>(() => new Set());
  const [shareDate, setShareDate] = useState('');
  const [taskDates, setTaskDates] = useState<Record<TaskType, string>>({
    im_shared: '',
    ff_shared: '',
    eoi_issued: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const alreadySharedIds = new Set(existingShares.map((s) => s.developer_id));
  const hasAnyTask = selectedTasks.size > 0;

  function toggleTask(type: TaskType) {
    setSelectedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
        setTaskDates((d) => (d[type] ? d : { ...d, [type]: todayIso() }));
        setShareDate((d) => d || todayIso());
      }
      return next;
    });
  }

  function handleOpen() {
    setSelectedTasks(new Set());
    setDeveloperId('');
    setNotes('');
    setShareDate('');
    setTaskDates({ im_shared: '', ff_shared: '', eoi_issued: '' });
    setError(null);
    setOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!developerId) { setError('Please select a developer'); return; }

    if (hasAnyTask && !shareDate) {
      setError('Share date is required when any task is selected');
      return;
    }
    for (const type of selectedTasks) {
      if (!taskDates[type]) {
        const label = TASK_OPTIONS.find((o) => o.type === type)?.dateLabel ?? 'Date';
        setError(`${label} is required`);
        return;
      }
    }

    setError(null);
    startTransition(async () => {
      const result = await shareWithDeveloper(assetId, developerId, {
        notes,
        share_date: hasAnyTask ? shareDate : null,
        selected_tasks: [...selectedTasks].map((type) => ({ type, date: taskDates[type] })),
      });
      if (result.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  const availableDevelopers = developers.filter((d) => !alreadySharedIds.has(d.id));

  return (
    <>
      <Button size="sm" variant="outline" onClick={handleOpen}>
        <Share2 className="mr-1.5 h-4 w-4" />
        Share with Developer
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex flex-col overflow-hidden">
          <SheetHeader className="border-b pb-4 shrink-0">
            <SheetTitle>Share with Developer</SheetTitle>
            <SheetDescription>Send this asset to a developer for evaluation.</SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            {/* ── Already shared with ──────────────────────────────── */}
            {existingShares.length > 0 && (
              <div className="p-4 border-b">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Already shared with
                </p>
                <div className="flex flex-col gap-1.5">
                  {existingShares.map((s) => {
                    const cfg = OUTCOME_CONFIG[s.outcome ?? ''];
                    return (
                      <div key={s.id} className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium truncate">{s.developer_name}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {cfg ? (
                            <span className={`flex items-center gap-1 text-xs ${cfg.className}`}>
                              {cfg.icon}
                              {cfg.label}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              Pending
                            </span>
                          )}
                          {s.last_completed_task && (s.outcome === 'interested' || s.outcome === 'pursuing' || s.outcome === 'won') && (
                            <span className="text-[10px] text-muted-foreground border rounded px-1 py-0.5">
                              Last: {s.last_completed_task}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4">
              {/* ── Developer select ─────────────────────────────────── */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="developer">Developer *</Label>
                {availableDevelopers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {developers.length === 0
                      ? 'No developers yet — add one on the Developers page first.'
                      : 'All developers have already been sent this asset.'}
                  </p>
                ) : (
                  <select
                    id="developer"
                    value={developerId}
                    onChange={(e) => setDeveloperId(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">— Select developer —</option>
                    {availableDevelopers.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* ── Tasks to log as completed ────────────────────────── */}
              <div className="flex flex-col gap-1.5">
                <Label>Tasks completed with this share</Label>
                <p className="text-[11px] text-muted-foreground -mt-0.5">
                  Tick each item that has already happened. A date is required for every ticked item.
                  Leave them all unticked to just log the share.
                </p>
                <div className="flex flex-col gap-3 mt-1">
                  {TASK_OPTIONS.map((opt) => {
                    const isChecked = selectedTasks.has(opt.type);
                    return (
                      <div key={opt.type} className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`task-${opt.type}`}
                            checked={isChecked}
                            onChange={() => toggleTask(opt.type)}
                            className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
                          />
                          <label
                            htmlFor={`task-${opt.type}`}
                            className="text-sm leading-none cursor-pointer select-none"
                          >
                            {opt.label}
                          </label>
                        </div>
                        {isChecked && (
                          <div className="flex items-center gap-2 pl-6">
                            <Label
                              htmlFor={`task-date-${opt.type}`}
                              className="text-xs text-muted-foreground shrink-0"
                            >
                              {opt.dateLabel} *
                            </Label>
                            <input
                              id={`task-date-${opt.type}`}
                              type="date"
                              required
                              max={todayIso()}
                              value={taskDates[opt.type]}
                              onChange={(e) =>
                                setTaskDates((d) => ({ ...d, [opt.type]: e.target.value }))
                              }
                              className="flex h-8 rounded-md border border-input bg-background px-2 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── Share date (only when any task ticked) ───────────── */}
              {hasAnyTask && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="share-date">Share date *</Label>
                  <p className="text-[11px] text-muted-foreground -mt-0.5">
                    When did you share this asset with the developer?
                  </p>
                  <input
                    id="share-date"
                    type="date"
                    required
                    max={todayIso()}
                    value={shareDate}
                    onChange={(e) => setShareDate(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
              )}

              {/* ── Notes ────────────────────────────────────────────── */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Any context for this share..."
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <SheetFooter className="p-0 mt-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>Cancel</Button>
                <Button type="submit" disabled={isPending || !developerId || availableDevelopers.length === 0}>
                  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Share
                </Button>
              </SheetFooter>
            </form>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
