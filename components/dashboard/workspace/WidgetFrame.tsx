'use client';

import { GripVertical, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { WIDGET_REGISTRY, type WidgetId, type WidgetSize } from '@/lib/dashboard-widgets';

interface Props {
  id: WidgetId;
  size: WidgetSize;
  isEditMode: boolean;
  isDragging: boolean;
  isDragOver: boolean;
  children: React.ReactNode;
  onRemove: () => void;
  onResize: (delta: -1 | 1) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
}

export function WidgetFrame({
  id, size, isEditMode, isDragging, isDragOver, children,
  onRemove, onResize, onDragStart, onDragEnd, onDragOver, onDrop,
}: Props) {
  const def = WIDGET_REGISTRY[id];
  const canShrink = size > def.minSize;
  const canGrow   = size < def.maxSize;

  return (
    <div
      draggable={isEditMode}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={(e) => { e.preventDefault(); onDrop(); }}
      className={`relative flex flex-col transition-all duration-200 ${
        isDragging  ? 'opacity-40 scale-[0.98]' : ''
      } ${isDragOver && !isDragging ? 'ring-2 ring-indigo-500 ring-offset-2 rounded-xl' : ''
      } ${isEditMode ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
      {/* Edit mode chrome */}
      {isEditMode && (
        <>
          {/* Top bar */}
          <div className="absolute inset-x-0 -top-px z-20 flex items-center justify-between px-2 py-1.5 bg-card/90 dark:bg-card/95 backdrop-blur-sm border border-border rounded-t-xl border-b-0">
            <div className="flex items-center gap-1.5">
              <GripVertical className="w-3.5 h-3.5 text-muted-foreground/60" />
              <span className="text-[10px] font-semibold text-muted-foreground/80">{def.name}</span>
            </div>
            <button
              onClick={onRemove}
              className="p-0.5 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-500 text-muted-foreground/50 transition-colors"
              aria-label={`Remove ${def.name}`}
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          {/* Content overlay — blocks clicks while editing */}
          <div className="absolute inset-0 z-10 rounded-xl ring-2 ring-dashed ring-border/60" />

          {/* Resize bar */}
          <div className="absolute inset-x-0 -bottom-px z-20 flex items-center justify-end gap-1 px-2 py-1 bg-card/90 dark:bg-card/95 backdrop-blur-sm border border-border rounded-b-xl border-t-0">
            <button
              onClick={() => onResize(-1)}
              disabled={!canShrink}
              className="p-0.5 rounded hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-muted-foreground"
              aria-label="Shrink widget"
            >
              <ChevronLeft className="w-3 h-3" />
            </button>
            <span className="text-[9px] text-muted-foreground/50 font-mono w-3 text-center">{size}</span>
            <button
              onClick={() => onResize(1)}
              disabled={!canGrow}
              className="p-0.5 rounded hover:bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-muted-foreground"
              aria-label="Grow widget"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </>
      )}

      {/* Widget content — pointer-events disabled in edit mode to prevent accidental nav */}
      <div className={`h-full ${isEditMode ? 'pointer-events-none select-none mt-6 mb-6' : ''}`}>
        {children}
      </div>
    </div>
  );
}
