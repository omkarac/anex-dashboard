'use client';

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { InlineStatusSelect } from '@/components/assets/inline-status-select';
import { InlineTemperatureSelect } from '@/components/assets/inline-temperature-select';
import { Button } from '@/components/ui/button';
import { ASSET_TYPE_LABELS } from '@/lib/enums/asset';
import { formatDate } from '@/lib/utils/formatters';
import type { Asset } from '@/lib/schemas/asset';
import type { TeamMemberOption } from '@/lib/queries/tasks';
import type { LatestUpdateSummary } from '@/lib/queries/updates';
import type { UnassignedTask, AssetOpenTask } from '@/lib/queries/developers';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { toCr } from '@/lib/utils/formatters';
import { UnassignedFAB } from '@/components/developers/unassigned-fab';

const GLOW_STYLES = `
  :root { --aw1:18,32,179; --aw2:40,60,210; --ah1:0.12; --ah2:0.30; }
  .dark  { --aw1:72,98,232; --aw2:100,130,255; --ah1:0.18; --ah2:0.42; }
  @keyframes asset-breathe {
    0%,100% { box-shadow: inset 3px 0 0 rgba(var(--aw1),var(--ah1)); }
    50%     { box-shadow: inset 3px 0 0 rgba(var(--aw2),var(--ah2)); }
  }
  .asset-row-urgent { animation: asset-breathe 2.5s ease-in-out infinite; }
  .asset-task-bdg {
    display:inline-flex; align-items:center; padding:1px 6px;
    border-radius:999px; font-size:10px; font-weight:600; line-height:1.6;
    background:rgba(var(--aw1),0.09); color:hsl(var(--primary));
    border:1px solid rgba(var(--aw1),0.22); margin-left:6px; vertical-align:middle;
  }
`;

function buildColumns(
  teamMembers: TeamMemberOption[],
  latestUpdates: Map<string, LatestUpdateSummary>,
  unassignedByAsset: Map<string, number>,
): ColumnDef<Asset>[] {
  return [
  {
    accessorKey: 'property_name',
    header: 'Property',
    cell: ({ row }) => {
      const urgentCount = unassignedByAsset.get(row.original.id) ?? 0;
      return (
        <Link
          href={`/capital-markets/assets/${row.original.id}`}
          className="font-medium hover:underline underline-offset-2 max-w-52 line-clamp-1 inline-flex items-center gap-1"
        >
          {row.original.property_name}
          {urgentCount > 0 && (
            <span className="asset-task-bdg">{urgentCount}</span>
          )}
        </Link>
      );
    },
  },
  {
    accessorKey: 'location',
    header: 'Location',
    cell: ({ row }) => (
      <span className="text-muted-foreground max-w-36 line-clamp-1 block">
        {row.original.location ?? '—'}
      </span>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <InlineStatusSelect assetId={row.original.id} current={row.original.status} />
    ),
  },
  {
    accessorKey: 'temperature',
    header: 'Temp',
    cell: ({ row }) => (
      <InlineTemperatureSelect assetId={row.original.id} current={row.original.temperature} />
    ),
  },
  {
    accessorKey: 'asset_type',
    header: 'Type',
    cell: ({ row }) =>
      row.original.asset_type
        ? ASSET_TYPE_LABELS[row.original.asset_type]
        : <span className="text-muted-foreground">—</span>,
  },
  {
    accessorKey: 'spoc_agent',
    header: 'SPOC',
    cell: ({ row }) => row.original.spoc_agent ?? <span className="text-muted-foreground">—</span>,
  },
  {
    accessorKey: 'initial_investment_cr',
    header: 'Inv. (Cr)',
    cell: ({ row }) => {
      const v = toCr(row.original.initial_investment_cr);
      return <span className="tabular-nums">{v != null ? v.toLocaleString('en-IN') : <span className="text-muted-foreground">—</span>}</span>;
    },
  },
  {
    accessorKey: 'topline_cr',
    header: 'Topline (Cr)',
    cell: ({ row }) => {
      const v = toCr(row.original.topline_cr);
      return <span className="tabular-nums">{v != null ? v.toLocaleString('en-IN') : <span className="text-muted-foreground">—</span>}</span>;
    },
  },
  {
    accessorKey: 'plot_size_sqm',
    header: 'Plot (sq.m.)',
    cell: ({ row }) => (
      <span className="tabular-nums">
        {row.original.plot_size_sqm != null
          ? row.original.plot_size_sqm.toLocaleString('en-IN')
          : <span className="text-muted-foreground">—</span>}
      </span>
    ),
  },
  {
    id: 'last_update',
    header: 'Last Update',
    cell: ({ row }) => {
      const u = latestUpdates.get(row.original.id);
      if (!u) return <span className="text-muted-foreground text-xs">—</span>;
      const text = u.update_task ?? u.body;
      return (
        <Link href={`/capital-markets/assets/${row.original.id}`} className="block group max-w-56">
          <span className="text-xs text-foreground leading-snug line-clamp-2 group-hover:underline underline-offset-2">
            {text.length > 80 ? text.slice(0, 80).trimEnd() + '…' : text}
          </span>
        </Link>
      );
    },
  },
  {
    accessorKey: 'assigned_to',
    header: 'Assigned',
    cell: ({ row }) => {
      const member = teamMembers.find((m) => m.id === row.original.assigned_to);
      return member
        ? <span className="text-xs font-medium">{member.full_name}</span>
        : <span className="text-muted-foreground text-xs">—</span>;
    },
  },
  {
    accessorKey: 'updated_at',
    header: 'Updated',
    cell: ({ row }) => (
      <span className="text-muted-foreground text-xs whitespace-nowrap">
        {formatDate(row.original.updated_at)}
      </span>
    ),
  },
];}

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

const PRIORITY_DOT: Record<string, string> = {
  high:   'bg-destructive',
  medium: 'bg-amber-500',
  low:    'bg-muted-foreground/50',
};

type HoveredRow = { id: string; rect: DOMRect };

type AssetTableProps = {
  data: Asset[];
  count: number;
  pageCount: number;
  page: number;
  teamMembers: TeamMemberOption[];
  latestUpdates: Map<string, LatestUpdateSummary>;
  unassignedTasks: UnassignedTask[];
  openTasks: AssetOpenTask[];
};

export function AssetTable({ data, count, pageCount, page, teamMembers, latestUpdates, unassignedTasks, openTasks }: AssetTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [hoveredRow, setHoveredRow] = useState<HoveredRow | null>(null);

  const unassignedByAsset = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of unassignedTasks) m.set(t.asset_id, (m.get(t.asset_id) ?? 0) + 1);
    return m;
  }, [unassignedTasks]);

  const openTasksByAsset = useMemo(() => {
    const m = new Map<string, AssetOpenTask[]>();
    for (const t of openTasks) {
      const arr = m.get(t.asset_id) ?? [];
      arr.push(t);
      m.set(t.asset_id, arr);
    }
    return m;
  }, [openTasks]);

  const columns = useMemo(
    () => buildColumns(teamMembers, latestUpdates, unassignedByAsset),
    [teamMembers, latestUpdates, unassignedByAsset],
  );

  function goToPage(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(p));
    router.push(`?${params.toString()}`);
  }

  const table = useReactTable({
    data,
    columns,
    pageCount,
    state: { pagination: { pageIndex: page - 1, pageSize: 50 } },
    onPaginationChange: (updater) => {
      const next =
        typeof updater === 'function'
          ? updater({ pageIndex: page - 1, pageSize: 50 })
          : updater;
      goToPage(next.pageIndex + 1);
    },
    manualPagination: true,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="flex flex-col gap-3">
      <style>{GLOW_STYLES}</style>
      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b bg-muted/40">
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap"
                  >
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row, i) => {
              const isUrgent = unassignedByAsset.has(row.original.id);
              const hasOpen = openTasksByAsset.has(row.original.id);
              return (
              <tr
                key={row.id}
                className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${i % 2 === 0 ? '' : 'bg-muted/10'} ${isUrgent ? 'asset-row-urgent' : ''}`}
                onMouseEnter={hasOpen ? (e) => setHoveredRow({ id: row.original.id, rect: e.currentTarget.getBoundingClientRect() }) : undefined}
                onMouseLeave={hasOpen ? () => setHoveredRow(null) : undefined}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2.5">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
              );
            })}
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-12 text-center text-muted-foreground">
                  No assets found matching the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between px-1">
        <p className="text-sm text-muted-foreground">
          {count} {count === 1 ? 'asset' : 'assets'}
          {pageCount > 1 && ` · page ${page} of ${pageCount}`}
        </p>
        {pageCount > 1 && (
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(page + 1)}
              disabled={page >= pageCount}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <UnassignedFAB tasks={unassignedTasks} members={teamMembers} />

      {/* Hover task preview — fixed overlay, pointer-events-none so it never blocks row events */}
      {hoveredRow && (() => {
        const tasks = openTasksByAsset.get(hoveredRow.id) ?? [];
        if (!tasks.length) return null;

        const today = new Date().toISOString().slice(0, 10);
        const totalOpen = tasks.length;
        const dueCount = tasks.filter((t) => t.due_date && t.due_date <= today).length;
        const top3 = [...tasks]
          .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1))
          .slice(0, 3);

        const viewportH = typeof window !== 'undefined' ? window.innerHeight : 800;
        const showAbove = hoveredRow.rect.bottom + 230 > viewportH;
        const top = showAbove ? hoveredRow.rect.top - 230 : hoveredRow.rect.bottom + 4;

        return (
          <div
            style={{ position: 'fixed', top, left: hoveredRow.rect.left + 16, zIndex: 200, pointerEvents: 'none', width: 272 }}
            className="rounded-xl border bg-card/95 backdrop-blur-xl shadow-2xl shadow-black/15 dark:shadow-black/40 overflow-hidden"
          >
            {/* Stat bar */}
            <div className="px-3 py-2.5 border-b border-border/50 flex items-center gap-4 bg-muted/30">
              <span className="inline-flex items-center gap-1.5">
                <span className="text-sm font-bold tabular-nums">{totalOpen}</span>
                <span className="text-xs text-muted-foreground">open task{totalOpen !== 1 ? 's' : ''}</span>
              </span>
              {dueCount > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                  <span className="text-sm font-bold tabular-nums text-destructive">{dueCount}</span>
                  <span className="text-xs text-destructive/80">due</span>
                </span>
              )}
            </div>

            {/* Top 3 tasks by priority */}
            <div className="px-3 py-2.5 flex flex-col gap-2">
              {top3.map((t) => (
                <div key={t.id} className="flex items-center gap-2.5 min-w-0">
                  <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${PRIORITY_DOT[t.priority] ?? 'bg-muted-foreground/50'}`} />
                  <span className="text-xs text-foreground truncate leading-none">{t.title}</span>
                  {t.due_date && t.due_date <= today && (
                    <span className="ml-auto shrink-0 text-[10px] font-semibold text-destructive">due</span>
                  )}
                </div>
              ))}
              {tasks.length > 3 && (
                <p className="text-[10px] text-muted-foreground pl-4">+{tasks.length - 3} more</p>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
