'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

type Props = {
  actors: { id: string; full_name: string }[];
  actions: string[];
  entityTypes: string[];
};

const ACTION_LABELS: Record<string, string> = {
  create: 'Create',
  update: 'Update',
  delete: 'Delete',
  status_change: 'Status Change',
  share: 'Share',
  convert: 'Convert',
  delete_log: 'Delete Log',
};

export function LogFilters({ actors, actions, entityTypes }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const set = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete('page');
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const q = searchParams.get('q') ?? '';
  const actorId = searchParams.get('actor_id') ?? '';
  const action = searchParams.get('action') ?? '';
  const entityType = searchParams.get('entity_type') ?? '';
  const from = searchParams.get('from') ?? '';
  const to = searchParams.get('to') ?? '';
  const showDeleted = searchParams.get('deleted') === '1';

  const hasFilters = q || actorId || action || entityType || from || to || showDeleted;

  function clearFilters() {
    router.push(pathname);
  }

  const selectClass =
    'h-8 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        value={q}
        onChange={(e) => set('q', e.target.value)}
        placeholder="Search summary…"
        className="h-8 text-xs w-48"
      />

      <select value={actorId} onChange={(e) => set('actor_id', e.target.value)} className={selectClass}>
        <option value="">All actors</option>
        {actors.map((a) => (
          <option key={a.id} value={a.id}>{a.full_name}</option>
        ))}
      </select>

      <select value={action} onChange={(e) => set('action', e.target.value)} className={selectClass}>
        <option value="">All actions</option>
        {actions.map((a) => (
          <option key={a} value={a}>{ACTION_LABELS[a] ?? a}</option>
        ))}
      </select>

      <select value={entityType} onChange={(e) => set('entity_type', e.target.value)} className={selectClass}>
        <option value="">All types</option>
        {entityTypes.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>

      <input
        type="date"
        value={from}
        onChange={(e) => set('from', e.target.value)}
        className={selectClass + ' w-32'}
        title="From date"
      />
      <input
        type="date"
        value={to}
        onChange={(e) => set('to', e.target.value)}
        className={selectClass + ' w-32'}
        title="To date"
      />

      <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
        <input
          type="checkbox"
          checked={showDeleted}
          onChange={(e) => set('deleted', e.target.checked ? '1' : '')}
          className="rounded"
        />
        Show deleted
      </label>

      {hasFilters && (
        <Button size="sm" variant="ghost" className="h-8 px-2" onClick={clearFilters}>
          <X className="h-3.5 w-3.5 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
}
