'use client';

import { useReducer, useEffect, useState } from 'react';
import {
  DEFAULT_DASHBOARD_STATE,
  WIDGET_REGISTRY,
  type DashboardState,
  type DashboardWindow,
  type WidgetId,
  type WidgetItem,
  type WidgetSize,
} from '@/lib/dashboard-widgets';

const STORAGE_KEY = 'anex-cm-dashboard-v1';

// ─── Reducer ──────────────────────────────────────────────────────────────────

type Action =
  | { type: 'LOAD'; payload: DashboardState }
  | { type: 'SET_ACTIVE'; index: number }
  | { type: 'ADD_WINDOW' }
  | { type: 'REMOVE_WINDOW'; index: number }
  | { type: 'RENAME_WINDOW'; index: number; name: string }
  | { type: 'ADD_WIDGET'; id: WidgetId }
  | { type: 'REMOVE_WIDGET'; id: WidgetId }
  | { type: 'RESIZE_WIDGET'; id: WidgetId; delta: -1 | 1 }
  | { type: 'REORDER_WIDGETS'; fromId: WidgetId; toId: WidgetId };

function patchActive(state: DashboardState, patch: (w: DashboardWindow) => DashboardWindow): DashboardState {
  return {
    ...state,
    windows: state.windows.map((w, i) => (i === state.activeIndex ? patch(w) : w)),
  };
}

function reducer(state: DashboardState, action: Action): DashboardState {
  switch (action.type) {
    case 'LOAD':
      return action.payload;

    case 'SET_ACTIVE':
      return { ...state, activeIndex: Math.max(0, Math.min(action.index, state.windows.length - 1)) };

    case 'ADD_WINDOW': {
      if (state.windows.length >= 5) return state;
      const newWin: DashboardWindow = {
        id: `win-${Date.now()}`,
        name: `Window ${state.windows.length + 1}`,
        widgets: [
          { id: 'pipeline-board', size: 4 },
          { id: 'activity-feed', size: 4 },
        ],
      };
      return { windows: [...state.windows, newWin], activeIndex: state.windows.length };
    }

    case 'REMOVE_WINDOW': {
      if (state.windows.length <= 1) return state;
      const windows = state.windows.filter((_, i) => i !== action.index);
      const activeIndex = Math.min(state.activeIndex, windows.length - 1);
      return { windows, activeIndex };
    }

    case 'RENAME_WINDOW':
      return {
        ...state,
        windows: state.windows.map((w, i) => (i === action.index ? { ...w, name: action.name } : w)),
      };

    case 'ADD_WIDGET': {
      const def = WIDGET_REGISTRY[action.id];
      return patchActive(state, (w) => {
        if (w.widgets.some((x) => x.id === action.id)) return w;
        return { ...w, widgets: [...w.widgets, { id: action.id, size: def.defaultSize }] };
      });
    }

    case 'REMOVE_WIDGET':
      return patchActive(state, (w) => ({
        ...w,
        widgets: w.widgets.filter((x) => x.id !== action.id),
      }));

    case 'RESIZE_WIDGET': {
      const def = WIDGET_REGISTRY[action.id];
      return patchActive(state, (w) => ({
        ...w,
        widgets: w.widgets.map((x): WidgetItem => {
          if (x.id !== action.id) return x;
          const next = Math.max(def.minSize, Math.min(def.maxSize, x.size + action.delta)) as WidgetSize;
          return { ...x, size: next };
        }),
      }));
    }

    case 'REORDER_WIDGETS':
      return patchActive(state, (w) => {
        const widgets = [...w.widgets];
        const fromIdx = widgets.findIndex((x) => x.id === action.fromId);
        const toIdx = widgets.findIndex((x) => x.id === action.toId);
        if (fromIdx === -1 || toIdx === -1) return w;
        const [moved] = widgets.splice(fromIdx, 1);
        widgets.splice(toIdx, 0, moved);
        return { ...w, widgets };
      });

    default:
      return state;
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDashboardLayout() {
  const [state, dispatch] = useReducer(reducer, DEFAULT_DASHBOARD_STATE);
  const [mounted, setMounted] = useState(false);

  // Hydrate from localStorage after mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as DashboardState;
        if (Array.isArray(parsed.windows) && parsed.windows.length > 0) {
          dispatch({ type: 'LOAD', payload: parsed });
        }
      }
    } catch {
      // ignore corrupt storage
    }
    setMounted(true);
  }, []);

  // Persist on every change (after mount)
  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, mounted]);

  const activeWindow = state.windows[state.activeIndex] ?? state.windows[0];

  return {
    state,
    mounted,
    activeWindow,
    dispatch,
    // Convenience action creators
    setActiveWindow: (index: number) => dispatch({ type: 'SET_ACTIVE', index }),
    addWindow:       ()               => dispatch({ type: 'ADD_WINDOW' }),
    removeWindow:    (index: number)  => dispatch({ type: 'REMOVE_WINDOW', index }),
    renameWindow:    (index: number, name: string) => dispatch({ type: 'RENAME_WINDOW', index, name }),
    addWidget:       (id: WidgetId)   => dispatch({ type: 'ADD_WIDGET', id }),
    removeWidget:    (id: WidgetId)   => dispatch({ type: 'REMOVE_WIDGET', id }),
    resizeWidget:    (id: WidgetId, delta: -1 | 1) => dispatch({ type: 'RESIZE_WIDGET', id, delta }),
    reorderWidgets:  (fromId: WidgetId, toId: WidgetId) => dispatch({ type: 'REORDER_WIDGETS', fromId, toId }),
  };
}
