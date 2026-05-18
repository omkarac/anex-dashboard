'use client';

import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { useState } from 'react';
import type { LeadStatus } from '@/lib/schemas/sales';

const STATUS_ROW_CLASS: Record<string, string> = {
  booked: 'row-booked',
  warm:   'row-warm',
  cold:   'row-cold',
  lost:   'row-lost',
};

interface SalesTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  getRowStatus?: (row: T) => LeadStatus | string | undefined;
  globalFilter?: string;
  onRowClick?: (row: T) => void;
}

export function SalesTable<T>({
  data,
  columns,
  getRowStatus,
  globalFilter,
  onRowClick,
}: SalesTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          {table.getHeaderGroups().map(hg => (
            <tr key={hg.id} style={{ borderBottom: '2px solid var(--sales-border)' }}>
              {hg.headers.map(header => (
                <th
                  key={header.id}
                  onClick={header.column.getToggleSortingHandler()}
                  style={{
                    padding: '10px 12px', textAlign: 'left',
                    fontSize: 10.5, fontWeight: 700, color: 'var(--sales-txt3)',
                    textTransform: 'uppercase', letterSpacing: '.5px',
                    background: 'var(--sales-card)',
                    cursor: header.column.getCanSort() ? 'pointer' : 'default',
                    userSelect: 'none', whiteSpace: 'nowrap',
                  }}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  {header.column.getIsSorted() === 'asc' && ' ↑'}
                  {header.column.getIsSorted() === 'desc' && ' ↓'}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map(row => {
            const status = getRowStatus?.(row.original);
            const rowClass = status ? (STATUS_ROW_CLASS[status] ?? '') : '';
            return (
              <tr
                key={row.id}
                className={rowClass}
                onClick={() => onRowClick?.(row.original)}
                style={{
                  borderBottom: '1px solid var(--sales-border-light)',
                  cursor: onRowClick ? 'pointer' : 'default',
                  transition: 'opacity .1s',
                }}
              >
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} style={{ padding: '10px 12px', color: 'var(--sales-txt)' }}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {table.getRowModel().rows.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--sales-txt3)', fontSize: 13 }}>
          No records found.
        </div>
      )}
    </div>
  );
}
