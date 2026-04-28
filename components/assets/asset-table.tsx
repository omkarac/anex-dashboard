'use client';

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { InlineStatusSelect } from '@/components/assets/inline-status-select';
import { InlineTemperatureSelect } from '@/components/assets/inline-temperature-select';
import { Button } from '@/components/ui/button';
import { ASSET_TYPE_LABELS } from '@/lib/enums/asset';
import { formatDate, formatSqm } from '@/lib/utils/formatters';
import type { Asset } from '@/lib/schemas/asset';
import type { TeamMemberOption } from '@/lib/queries/tasks';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { toCr } from '@/lib/utils/formatters';

function buildColumns(teamMembers: TeamMemberOption[]): ColumnDef<Asset>[] {
  return [
  {
    accessorKey: 'property_name',
    header: 'Property',
    cell: ({ row }) => (
      <Link
        href={`/assets/${row.original.id}`}
        className="font-medium hover:underline underline-offset-2 max-w-52 line-clamp-1 block"
      >
        {row.original.property_name}
      </Link>
    ),
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
    accessorKey: 'next_step',
    header: 'Next Step',
    cell: ({ row }) => {
      const text = row.original.next_step;
      if (!text) return <span className="text-muted-foreground text-xs">—</span>;
      const truncated = text.length > 60;
      return (
        <span className="text-xs text-muted-foreground">
          {truncated ? text.slice(0, 60).trimEnd() + '…' : text}
          {truncated && (
            <Link
              href={`/assets/${row.original.id}`}
              className="ml-1 text-foreground hover:underline underline-offset-2 whitespace-nowrap"
            >
              read more
            </Link>
          )}
        </span>
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

type AssetTableProps = {
  data: Asset[];
  count: number;
  pageCount: number;
  page: number;
  teamMembers: TeamMemberOption[];
};

export function AssetTable({ data, count, pageCount, page, teamMembers }: AssetTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const columns = useMemo(() => buildColumns(teamMembers), [teamMembers]);

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
            {table.getRowModel().rows.map((row, i) => (
              <tr
                key={row.id}
                className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${i % 2 === 0 ? '' : 'bg-muted/10'}`}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2.5">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
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
    </div>
  );
}
