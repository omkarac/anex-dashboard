'use client';

import { useState, useMemo } from 'react';
import { X, Search } from 'lucide-react';
import { WIDGET_REGISTRY, WIDGET_CATEGORIES, type WidgetId, type WidgetItem, type WidgetCategory } from '@/lib/dashboard-widgets';

interface Props {
  open: boolean;
  activeWidgets: WidgetItem[];
  onAdd: (id: WidgetId) => void;
  onClose: () => void;
}

const CATEGORY_ACCENT: Record<WidgetCategory, string> = {
  Personal: 'text-indigo-500',
  Synergy: 'text-emerald-500',
  Velocity: 'text-amber-500',
  Pipeline: 'text-sky-500',
  Activity: 'text-violet-500',
  Team: 'text-rose-500',
  Insights: 'text-cyan-500',
  Hygiene: 'text-slate-500',
};

export function WidgetGallery({ open, activeWidgets, onAdd, onClose }: Props) {
  const activeIds = new Set(activeWidgets.map((w) => w.id));
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return Object.values(WIDGET_REGISTRY).filter((w) => {
      if (!q) return true;
      return (
        w.name.toLowerCase().includes(q) ||
        w.description.toLowerCase().includes(q) ||
        w.category.toLowerCase().includes(q)
      );
    });
  }, [query]);

  const totalAdded = activeWidgets.length;

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20 dark:bg-black/40 backdrop-blur-[2px]"
          onClick={onClose}
        />
      )}

      {/* Slide-in panel */}
      <div
        className={`fixed right-0 top-0 h-full z-50 w-96 bg-card border-l border-border shadow-2xl flex flex-col transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Widget Gallery</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              <span className="font-semibold tabular-nums">{totalAdded}</span> of {Object.keys(WIDGET_REGISTRY).length} added to this view
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            aria-label="Close gallery"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b border-border shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search widgets…"
              className="w-full h-8 pl-8 pr-3 rounded-md bg-muted/40 border border-transparent text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-indigo-400 focus:bg-card transition-colors"
            />
          </div>
        </div>

        {/* Widget list by category */}
        <div className="flex-1 overflow-auto py-4">
          {filtered.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-xs text-muted-foreground">No widgets match “{query}”.</p>
            </div>
          ) : (
            WIDGET_CATEGORIES.map((cat) => {
              const widgets = filtered.filter((w) => w.category === cat);
              if (widgets.length === 0) return null;
              const accent = CATEGORY_ACCENT[cat];

              return (
                <div key={cat} className="mb-6">
                  <div className="flex items-center justify-between px-5 mb-2">
                    <p className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${accent}`}>
                      {cat}
                    </p>
                    <span className="text-[10px] text-muted-foreground/60 tabular-nums">
                      {widgets.length}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 px-3">
                    {widgets.map((def) => {
                      const isAdded = activeIds.has(def.id);
                      return (
                        <div
                          key={def.id}
                          className={`flex items-start gap-3 px-3 py-3 rounded-lg transition-all ${
                            isAdded
                              ? 'opacity-40 cursor-default'
                              : 'hover:bg-muted/60 cursor-pointer group'
                          }`}
                          onClick={() => !isAdded && onAdd(def.id)}
                          role={isAdded ? undefined : 'button'}
                          tabIndex={isAdded ? -1 : 0}
                          onKeyDown={(e) => !isAdded && e.key === 'Enter' && onAdd(def.id)}
                        >
                          {/* Icon */}
                          <span className={`text-lg leading-none shrink-0 mt-0.5 select-none ${accent}`}>
                            {def.icon}
                          </span>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-foreground">{def.name}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                              {def.description}
                            </p>
                          </div>

                          {/* State indicator */}
                          <div className="shrink-0 mt-0.5">
                            {isAdded ? (
                              <span className="text-[10px] font-bold text-muted-foreground/60 bg-muted px-2 py-0.5 rounded-full">
                                Added
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                + Add
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer hint */}
        <div className="border-t border-border px-5 py-3 shrink-0">
          <p className="text-[11px] text-muted-foreground/60 text-center">
            Drag to reorder · click ← → to resize
          </p>
        </div>
      </div>
    </>
  );
}
