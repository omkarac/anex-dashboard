'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { actionLabel } from '@/lib/enums/audit';
import type { AuditVertical } from '@/lib/queries/logs';

type Props = {
  actors: { id: string; full_name: string }[];
  actions: string[];
  entityTypes: string[];
  showVerticalSwitcher?: boolean;
};

const VERTICAL_OPTIONS: { value: AuditVertical; label: string }[] = [
  { value: 'all', label: 'All verticals' },
  { value: 'capital_markets', label: 'Capital Markets' },
  { value: 'sales_marketing', label: 'Sales & Marketing' },
];

const selectClass =
  'h-8 rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

export function AuditFilters({ actors, actions, entityTypes, showVerticalSwitcher = true }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const set = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      params.delete('page');
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const vertical = searchParams.get('vertical') ?? 'all';
  const q = searchParams.get('q') ?? '';
  const actorId = searchParams.get('actor_id') ?? '';
  const action = searchParams.get('action') ?? '';
  const entityType = searchParams.get('entity_type') ?? '';
  const from = searchParams.get('from') ?? '';
  const to = searchParams.get('to') ?? '';
  const showDeleted = searchParams.get('deleted') === '1';

  const hasFilters = (vertical && vertical !== 'all') || q || actorId || action || entityType || from || to || showDeleted;

  function clearFilters() {
    const params = new URLSearchParams();
    const view = searchParams.get('view');
    if (view) params.set('view', view);
    router.push(params.toString() ? `${pathname}?${params.toString()}` : pathname);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {showVerticalSwitcher && (
        <select value={vertical} onChange={(e) => set('vertical', e.target.value)} className={selectClass + ' font-medium'}>
          {VERTICAL_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )}

      <Input
        value={q}
        onChange={(e) => set('q', e.target.value)}
        placeholder="Search summary…"
        className="h-8 text-xs w-44"
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
          <option key={a} value={a}>{actionLabel(a)}</option>
        ))}
      </select>

      <select value={entityType} onChange={(e) => set('entity_type', e.target.value)} className={selectClass}>
        <option value="">All types</option>
        {entityTypes.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>

      {/* Uncontrolled + commit on blur: a controlled date input that pushes to
          the URL per-keystroke interrupts manual year entry (2026 → 00XX). */}
      <input
        key={`from-${from}`}
        type="date"
        defaultValue={from}
        onBlur={(e) => set('from', e.target.value)}
        className={selectClass + ' w-32'}
        title="From date"
      />
      <input
        key={`to-${to}`}
        type="date"
        defaultValue={to}
        onBlur={(e) => set('to', e.target.value)}
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
