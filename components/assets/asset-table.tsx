'use client';

import React, { useMemo, useState, useRef } from 'react';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
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
  @keyframes detail-in {
    from { opacity:0; }
    to   { opacity:1; }
  }
  .asset-row-urgent { animation: asset-breathe 2.5s ease-in-out infinite; }
  .asset-detail-row { animation: detail-in 0.12s ease-out; }
  .asset-task-bdg {
    display:inline-flex; align-items:center; padding:1px 6px;
    border-radius:999px; font-size:10px; font-weight:600; line-height:1.6;
    background:rgba(var(--aw1),0.09); color:hsl(var(--primary));
    border:1px solid rgba(var(--aw1),0.22); margin-left:6px; vertical-align:middle;
  }
`;

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };
const PRIORITY_DOT: Record<string, string> = {
  high:   'bg-destructive',
  medium: 'bg-amber-500',
  low:    'bg-muted-foreground/40',
};
const PRIORITY_LABEL: Record<string, string> = { high: 'High', medium: 'Med', low: 'Low' };

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
            {urgentCount > 0 && <span className="asset-task-bdg">{urgentCount}</span>}
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
      cell: ({ row }) => <InlineStatusSelect assetId={row.original.id} current={row.original.status} />,
    },
    {
      accessorKey: 'temperature',
      header: 'Temp',
      cell: ({ row }) => <InlineTemperatureSelect assetId={row.original.id} current={row.original.temperature} />,
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
  ];
}

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
  const [expandedAsset, setExpandedAsset] = useState<string | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  function showRow(assetId: string) {
    if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; }
    if (openTasksByAsset.has(assetId)) setExpandedAsset(assetId);
  }

  function hideRow() {
    hideTimer.current = setTimeout(() => { setExpandedAsset(null); hideTimer.current = null; }, 180);
  }

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
      const next = typeof updater === 'function' ? updater({ pageIndex: page - 1, pageSize: 50 }) : updater;
      goToPage(next.pageIndex + 1);
    },
    manualPagination: true,
    getCoreRowModel: getCoreRowModel(),
  });

  const today = new Date().toISOString().slice(0, 10);

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
              const tasks = openTasksByAsset.get(row.original.id) ?? [];
              const isExpanded = expandedAsset === row.original.id && tasks.length > 0;

              const totalOpen = tasks.length;
              const dueCount = tasks.filter((t) => t.due_date && t.due_date <= today).length;
              const top3 = [...tasks]
                .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1))
                .slice(0, 3);

              return (
                <React.Fragment key={row.id}>
                  <tr
                    className={`border-b transition-colors ${isExpanded ? 'bg-muted/20' : `hover:bg-muted/30 ${i % 2 !== 0 ? 'bg-muted/10' : ''}`} ${isUrgent ? 'asset-row-urgent' : ''}`}
                    onMouseEnter={() => showRow(row.original.id)}
                    onMouseLeave={hideRow}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-3 py-2.5">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>

                  {isExpanded && (
                    <tr
                      className="asset-detail-row border-b bg-muted/10"
                      onMouseEnter={() => showRow(row.original.id)}
                      onMouseLeave={hideRow}
                    >
                      <td colSpan={columns.length} className="px-4 py-0">
                        <div className="py-2.5 flex items-center gap-6 flex-wrap">

                          {/* Stat pills */}
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="inline-flex items-center gap-1.5">
                              <span className="text-xs font-bold tabular-nums">{totalOpen}</span>
                              <span className="text-xs text-muted-foreground">open</span>
                            </span>
                            {dueCount > 0 && (
                              <span className="inline-flex items-center gap-1.5">
                                <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                                <span className="text-xs font-bold tabular-nums text-destructive">{dueCount}</span>
                                <span className="text-xs text-destructive/80">due</span>
                              </span>
                            )}
                          </div>

                          {/* Divider */}
                          <span className="text-border select-none">·</span>

                          {/* Top tasks */}
                          <div className="flex items-center gap-2 flex-wrap min-w-0">
                            {top3.map((t) => (
                              <span
                                key={t.id}
                                className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-0.5 text-xs"
                              >
                                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${PRIORITY_DOT[t.priority] ?? 'bg-muted-foreground/40'}`} />
                                <span className="truncate max-w-[160px]">{t.title}</span>
                                <span className="text-muted-foreground/60 text-[10px] shrink-0">{PRIORITY_LABEL[t.priority]}</span>
                                {t.due_date && t.due_date <= today && (
                                  <span className="text-destructive text-[10px] font-semibold shrink-0">due</span>
                                )}
                              </span>
                            ))}
                            {tasks.length > 3 && (
                              <span className="text-[11px] text-muted-foreground">+{tasks.length - 3} more</span>
                            )}
                          </div>

                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
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
            <Button variant="outline" size="sm" onClick={() => goToPage(page - 1)} disabled={page <= 1} className="h-8 w-8 p-0">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => goToPage(page + 1)} disabled={page >= pageCount} className="h-8 w-8 p-0">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <UnassignedFAB tasks={unassignedTasks} members={teamMembers} />
    </div>
  );
}
