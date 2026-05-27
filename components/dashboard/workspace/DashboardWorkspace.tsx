'use client';

import { useState, useRef } from 'react';
import { LayoutGrid, Plus, Pencil, Check, X, Layers } from 'lucide-react';
import { useDashboardLayout } from '@/hooks/useDashboardLayout';
import { WidgetFrame } from './WidgetFrame';
import { WidgetGallery } from './WidgetGallery';
import { PipelineBoardWidget } from '@/components/dashboard/pipeline-board';
import { AttentionPanel } from '@/components/dashboard/attention-panel';
import { DealAgingWidget } from '@/components/dashboard/deal-aging';
import { TeamBandwidth } from '@/components/dashboard/team-bandwidth';
import { RecentActivityWidget } from '@/components/dashboard/recent-activity-widget';
import { HotDealsWidget } from '@/components/dashboard/widgets/HotDealsWidget';
import { WinRateWidget } from '@/components/dashboard/widgets/WinRateWidget';
import { StaleDealsWidget } from '@/components/dashboard/widgets/StaleDealsWidget';
import { MyDayWidget } from '@/components/dashboard/widgets-v2/MyDayWidget';
import { UpdateStreakWidget } from '@/components/dashboard/widgets-v2/UpdateStreakWidget';
import { ClosingLoopWidget } from '@/components/dashboard/widgets-v2/ClosingLoopWidget';
import { HandoffHealthWidget } from '@/components/dashboard/widgets-v2/HandoffHealthWidget';
import { CollabGraphWidget } from '@/components/dashboard/widgets-v2/CollabGraphWidget';
import { QuietAssetsOwnerWidget } from '@/components/dashboard/widgets-v2/QuietAssetsOwnerWidget';
import { WeekOverWeekWidget } from '@/components/dashboard/widgets-v2/WeekOverWeekWidget';
import { StageThroughputWidget } from '@/components/dashboard/widgets-v2/StageThroughputWidget';
import { TaskSlaWidget } from '@/components/dashboard/widgets-v2/TaskSlaWidget';
import { OrphanedWorkWidget } from '@/components/dashboard/widgets-v2/OrphanedWorkWidget';
import { EngagementCoverageWidget } from '@/components/dashboard/widgets-v2/EngagementCoverageWidget';
import type { WidgetId } from '@/lib/dashboard-widgets';
import type {
  CommandStats,
  PipelineBoard,
  DealAging,
  AttentionSignal,
  MemberWorkload,
  RecentLog,
} from '@/lib/queries/dashboard';
import type {
  MyDay,
  UpdateStreak,
  ClosingLoop,
  HandoffHealth,
  CollabGraph,
  QuietAssetsByOwner,
  WeekOverWeek,
  StageThroughput,
  TaskSla,
  OrphanedWork,
  EngagementCoverage,
} from '@/lib/queries/dashboard-productivity';

// Tailwind col-span classes must be present as full strings so the JIT includes them
const MD_SPAN: Record<1 | 2 | 3 | 4, string> = {
  1: 'md:col-span-1',
  2: 'md:col-span-2',
  3: 'md:col-span-3',
  4: 'md:col-span-4',
};

export type DashboardData = {
  stats: CommandStats;
  board: PipelineBoard;
  aging: DealAging;
  signals: AttentionSignal[];
  workload: MemberWorkload[];
  recentLogs: RecentLog[];
  myDay: MyDay;
  updateStreak: UpdateStreak;
  closingLoop: ClosingLoop;
  handoffHealth: HandoffHealth;
  collabGraph: CollabGraph;
  quietByOwner: QuietAssetsByOwner;
  weekOverWeek: WeekOverWeek;
  stageThroughput: StageThroughput;
  taskSla: TaskSla;
  orphanedWork: OrphanedWork;
  engagementCoverage: EngagementCoverage;
};

interface Props {
  data: DashboardData;
  memberName: string;
}

export function DashboardWorkspace({ data, memberName }: Props) {
  const {
    state, mounted, activeWindow,
    setActiveWindow, addWindow, removeWindow, renameWindow,
    addWidget, removeWidget, resizeWidget, reorderWidgets,
  } = useDashboardLayout();

  const [isEditMode, setIsEditMode] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [draggingId, setDraggingId] = useState<WidgetId | null>(null);
  const [dragOverId, setDragOverId] = useState<WidgetId | null>(null);
  const [renamingIndex, setRenamingIndex] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  function renderWidget(id: WidgetId) {
    switch (id) {
      // Existing
      case 'pipeline-board':   return <PipelineBoardWidget board={data.board} />;
      case 'attention-panel':  return <AttentionPanel signals={data.signals} />;
      case 'deal-aging':       return <DealAgingWidget aging={data.aging} />;
      case 'team-bandwidth':   return <TeamBandwidth workload={data.workload} />;
      case 'activity-feed':    return <RecentActivityWidget logs={data.recentLogs} />;
      case 'hot-deals':        return <HotDealsWidget deals={data.board.hotDeals} />;
      case 'win-rate':         return <WinRateWidget stats={data.stats} />;
      case 'stale-deals':      return <StaleDealsWidget deals={data.board.staleDeals} />;
      // Personal
      case 'my-day':           return <MyDayWidget data={data.myDay} memberName={memberName} />;
      case 'update-streak':    return <UpdateStreakWidget data={data.updateStreak} />;
      case 'closing-loop':     return <ClosingLoopWidget data={data.closingLoop} />;
      // Synergy
      case 'handoff-health':   return <HandoffHealthWidget data={data.handoffHealth} />;
      case 'collab-graph':     return <CollabGraphWidget data={data.collabGraph} />;
      case 'quiet-assets-owner': return <QuietAssetsOwnerWidget data={data.quietByOwner} />;
      // Velocity
      case 'week-over-week':   return <WeekOverWeekWidget data={data.weekOverWeek} />;
      case 'stage-throughput': return <StageThroughputWidget data={data.stageThroughput} />;
      case 'task-sla':         return <TaskSlaWidget data={data.taskSla} />;
      // Hygiene
      case 'orphaned-work':    return <OrphanedWorkWidget data={data.orphanedWork} />;
      case 'engagement-coverage': return <EngagementCoverageWidget data={data.engagementCoverage} />;
    }
  }

  function startRename(index: number, currentName: string) {
    setRenamingIndex(index);
    setRenameValue(currentName);
    setTimeout(() => renameInputRef.current?.focus(), 0);
  }

  function commitRename() {
    if (renamingIndex !== null && renameValue.trim()) {
      renameWindow(renamingIndex, renameValue.trim());
    }
    setRenamingIndex(null);
  }

  // Skeleton during SSR hydration — prevents layout flash
  if (!mounted) {
    return (
      <div className="flex flex-col gap-4 p-5">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-40 rounded-xl bg-muted/40 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* ── Tab bar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-0 border-b border-border bg-card px-4 shrink-0 overflow-x-auto">
        {state.windows.map((win, i) => {
          const isActive = i === state.activeIndex;
          const isRenaming = renamingIndex === i;

          return (
            <div
              key={win.id}
              className={`group relative flex items-center shrink-0 h-10 px-3 gap-1.5 cursor-pointer border-b-2 transition-all select-none ${
                isActive
                  ? 'border-indigo-500 text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
              onClick={() => !isRenaming && setActiveWindow(i)}
            >
              {isRenaming ? (
                <input
                  ref={renameInputRef}
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') setRenamingIndex(null);
                  }}
                  onBlur={commitRename}
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs font-medium bg-transparent border-b border-indigo-400 outline-none w-24 text-foreground"
                />
              ) : (
                <span className="text-xs font-medium truncate max-w-[140px]">{win.name}</span>
              )}

              {!isRenaming && (
                <div className="flex items-center gap-0.5">
                  {isEditMode && (
                    <button
                      onClick={(e) => { e.stopPropagation(); startRename(i, win.name); }}
                      className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="Rename view"
                    >
                      <Pencil className="w-2.5 h-2.5" />
                    </button>
                  )}
                  {state.windows.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`Delete view "${win.name}"? This cannot be undone.`)) {
                          removeWindow(i);
                        }
                      }}
                      className={`p-0.5 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-500 transition-all ${
                        isActive
                          ? 'text-muted-foreground hover:text-rose-500'
                          : 'text-muted-foreground/60 opacity-0 group-hover:opacity-100 hover:text-rose-500'
                      }`}
                      aria-label={`Delete view ${win.name}`}
                      title="Delete view"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Add window button */}
        {state.windows.length < 6 && (
          <button
            onClick={addWindow}
            className="flex items-center gap-1 h-10 px-2.5 text-muted-foreground hover:text-foreground transition-colors shrink-0"
            aria-label="Add window"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Toolbar */}
        <div className="flex items-center gap-1 shrink-0 py-1">
          {isEditMode && (
            <button
              onClick={() => { setGalleryOpen(true); }}
              className="flex items-center gap-1.5 h-7 px-3 rounded-md text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-950/60 transition-colors"
            >
              <Layers className="w-3 h-3" />
              Add Widget
            </button>
          )}
          <button
            onClick={() => {
              setIsEditMode((v) => !v);
              setGalleryOpen(false);
            }}
            className={`flex items-center gap-1.5 h-7 px-3 rounded-md text-[11px] font-semibold transition-colors ${
              isEditMode
                ? 'bg-indigo-500 text-white hover:bg-indigo-600'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            {isEditMode ? (
              <>
                <Check className="w-3 h-3" />
                Done
              </>
            ) : (
              <>
                <LayoutGrid className="w-3 h-3" />
                Customize
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Widget grid ─────────────────────────────────────────────────────── */}
      <div className={`flex-1 overflow-auto p-5 transition-colors ${isEditMode ? 'bg-muted/20' : 'bg-background'}`}>
        {activeWindow.widgets.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <Layers className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold text-foreground">No widgets yet</p>
            <p className="text-xs text-muted-foreground">Open the widget gallery to add your first widget.</p>
            <button
              onClick={() => { setIsEditMode(true); setGalleryOpen(true); }}
              className="mt-1 h-8 px-4 rounded-lg text-xs font-semibold bg-indigo-500 text-white hover:bg-indigo-600 transition-colors"
            >
              Open Gallery
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 auto-rows-auto">
            {activeWindow.widgets.map((item) => (
              <div
                key={item.id}
                className={`${MD_SPAN[item.size]} min-h-[200px]`}
              >
                <WidgetFrame
                  id={item.id}
                  size={item.size}
                  isEditMode={isEditMode}
                  isDragging={draggingId === item.id}
                  isDragOver={dragOverId === item.id && draggingId !== item.id}
                  onRemove={() => removeWidget(item.id)}
                  onResize={(delta) => resizeWidget(item.id, delta)}
                  onDragStart={() => setDraggingId(item.id)}
                  onDragEnd={() => { setDraggingId(null); setDragOverId(null); }}
                  onDragOver={(e) => { e.preventDefault(); setDragOverId(item.id); }}
                  onDrop={() => {
                    if (draggingId && draggingId !== item.id) {
                      reorderWidgets(draggingId, item.id);
                    }
                    setDraggingId(null);
                    setDragOverId(null);
                  }}
                >
                  <div className="h-full min-h-[200px]">
                    {renderWidget(item.id)}
                  </div>
                </WidgetFrame>
              </div>
            ))}
          </div>
        )}

        {/* Edit mode hint bar */}
        {isEditMode && activeWindow.widgets.length > 0 && (
          <div className="mt-4 flex items-center justify-center gap-2">
            <p className="text-[11px] text-muted-foreground/60 text-center">
              Drag to reorder · click ← → to resize · × to remove
            </p>
          </div>
        )}
      </div>

      {/* ── Widget Gallery ──────────────────────────────────────────────────── */}
      <WidgetGallery
        open={galleryOpen}
        activeWidgets={activeWindow.widgets}
        onAdd={(id) => { addWidget(id); }}
        onClose={() => setGalleryOpen(false)}
      />
    </div>
  );
}
