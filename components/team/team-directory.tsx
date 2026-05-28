'use client';

import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { MemberRow } from '@/components/team/member-row';
import type { TeamMemberWithWorkload } from '@/lib/queries/team';

type Filter = 'all' | 'admin' | 'cm' | 'sm' | 'unassigned' | 'inactive';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All active' },
  { id: 'admin', label: 'Admins' },
  { id: 'cm', label: 'Capital Markets' },
  { id: 'sm', label: 'Sales & Marketing' },
  { id: 'unassigned', label: 'Unassigned' },
  { id: 'inactive', label: 'Inactive' },
];

function matches(m: TeamMemberWithWorkload, f: Filter): boolean {
  const live = m.is_active && m.status !== 'pending';
  switch (f) {
    case 'all':
      return live;
    case 'admin':
      return live && m.role === 'admin';
    case 'cm':
      return (
        live &&
        m.role !== 'admin' &&
        (m.department === 'cm' || m.department === 'both')
      );
    case 'sm':
      return (
        live &&
        m.role !== 'admin' &&
        (m.department === 'sm' || m.department === 'both')
      );
    case 'unassigned':
      return live && m.role !== 'admin' && !m.department;
    case 'inactive':
      return !m.is_active;
  }
}

const ROLE_RANK: Record<string, number> = {
  admin: 0,
  sales_admin: 1,
  sales_head: 2,
  sales_manager: 3,
  member: 4,
};

const DEPT_RANK: Record<string, number> = {
  both: 0,
  cm: 1,
  sm: 2,
  unassigned: 3,
};

export function TeamDirectory({
  members,
  currentUserId,
  isAdmin,
}: {
  members: TeamMemberWithWorkload[];
  currentUserId: string;
  isAdmin: boolean;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const counts = useMemo(() => {
    const out = {} as Record<Filter, number>;
    for (const f of FILTERS) out[f.id] = members.filter((m) => matches(m, f.id)).length;
    return out;
  }, [members]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = members.filter((m) => {
      if (!matches(m, filter)) return false;
      if (!q) return true;
      return (
        m.full_name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
      );
    });
    return filtered.sort((a, b) => {
      const ra = ROLE_RANK[a.role] ?? 5;
      const rb = ROLE_RANK[b.role] ?? 5;
      if (ra !== rb) return ra - rb;
      const da = DEPT_RANK[a.department ?? 'unassigned'] ?? 4;
      const db = DEPT_RANK[b.department ?? 'unassigned'] ?? 4;
      if (da !== db) return da - db;
      return a.full_name.localeCompare(b.full_name);
    });
  }, [members, filter, query]);

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar: search + filter chips */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or email…"
            className="w-full h-9 pl-9 pr-9 rounded-md border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 rounded-sm text-muted-foreground hover:bg-muted flex items-center justify-center"
              aria-label="Clear search"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTERS.map((f) => {
            const active = filter === f.id;
            const count = counts[f.id];
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={
                  active
                    ? 'inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium bg-foreground text-background transition-colors'
                    : 'inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium bg-muted text-foreground hover:bg-muted/70 transition-colors'
                }
              >
                {f.label}
                <span
                  className={
                    active
                      ? 'inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-background/20 text-[10px] font-semibold'
                      : 'inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-foreground/10 text-[10px] font-semibold text-muted-foreground'
                  }
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Directory table */}
      <div className="rounded-lg border bg-card overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            {query
              ? `No members match "${query}" in this view.`
              : 'Nothing here yet.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="border-b">
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Member
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-32">
                  Role
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-44">
                  Department
                </th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground w-24">
                  Open Tasks
                </th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground w-24">
                  SPOC Assets
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-28">
                  Status
                </th>
                <th className="px-4 py-2.5 w-10" />
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <MemberRow
                  key={m.id}
                  member={m}
                  currentUserId={currentUserId}
                  isCurrentUserAdmin={isAdmin}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
