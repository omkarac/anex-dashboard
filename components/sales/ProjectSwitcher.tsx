'use client';

import { useEffect, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { SalesProject } from '@/lib/schemas/sales';

const STORAGE_KEY = 'anex_selected_project';

interface ProjectSwitcherProps {
  projects: SalesProject[];
  onProjectChange?: (projectId: string) => void;
}

export function ProjectSwitcher({ projects, onProjectChange }: ProjectSwitcherProps) {
  const [selected, setSelected] = useState<string>('');

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && projects.find(p => p.id === stored)) {
      setSelected(stored);
      onProjectChange?.(stored);
    } else if (projects.length > 0) {
      setSelected(projects[0].id);
      localStorage.setItem(STORAGE_KEY, projects[0].id);
      onProjectChange?.(projects[0].id);
    }
  }, [projects, onProjectChange]);

  function handleChange(value: string | null) {
    if (!value) return;
    setSelected(value);
    localStorage.setItem(STORAGE_KEY, value);
    onProjectChange?.(value);
    // Full page reload so server components pick up the new project
    window.location.search = `?project=${value}`;
  }

  if (projects.length === 0) return null;

  const current = projects.find(p => p.id === selected);

  return (
    <Select value={selected} onValueChange={handleChange}>
      <SelectTrigger className="h-8 text-xs w-48 border-sidebar-border bg-sidebar-accent/30">
        <SelectValue placeholder="Select project">
          {current && (
            <span className="truncate">
              <span className="font-medium">{current.name}</span>
              {current.location && (
                <span className="text-muted-foreground ml-1">· {current.location}</span>
              )}
            </span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {projects.map(p => (
          <SelectItem key={p.id} value={p.id}>
            <div className="flex flex-col">
              <span className="font-medium text-sm">{p.name}</span>
              {p.location && <span className="text-xs text-muted-foreground">{p.location}</span>}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function getStoredProjectId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEY);
}
