'use client';

import { useState, useTransition } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { deleteActivityLog } from '@/lib/actions/logs';
import { formatDate, formatTimeAgo } from '@/lib/utils/formatters';
import type { LogEntry } from '@/lib/queries/logs';

const ACTION_LABELS: Record<string, string> = {
  create: 'Created',
  update: 'Updated',
  delete: 'Deleted',
  status_change: 'Status',
  share: 'Shared',
  convert: 'Converted',
  delete_log: 'Del. Log',
};

const ENTITY_LINKS: Record<string, (id: string) => string | null> = {
  asset: (id) => `/assets/${id}`,
  update: () => null,
  task: () => null,
  developer_share: () => null,
  activity_log: () => null,
};

function DeleteCell({ log }: { log: LogEntry }) {
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState('');
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (log.deleted_at) {
    return (
      <span className="text-xs text-muted-foreground italic">
        {log.delete_reason ? `Deleted: ${log.delete_reason}` : 'Deleted'}
      </span>
    );
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
        <Input
          autoFocus
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason…"
          className="h-6 text-xs w-32 px-1.5"
          onKeyDown={(e) => {
            if (e.key === 'Escape') { setConfirming(false); setReason(''); }
          }}
        />
        <Button
          size="sm"
          variant="destructive"
          className="h-6 px-2 text-xs"
          disabled={isPending || !reason.trim()}
          onClick={() =>
            startTransition(async () => {
              const result = await deleteActivityLog(log.id, reason);
              if (result.ok) {
                setConfirming(false);
                setReason('');
                router.refresh();
              }
            })
          }
        >
          Confirm
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-1.5 text-xs"
          onClick={() => { setConfirming(false); setReason(''); }}
        >
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}

type Props = {
  logs: LogEntry[];
  total: number;
  page: number;
};

const PAGE_SIZE = 50;

export function LogTable({ logs, total, page }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const totalPages = Math.ceil(total / PAGE_SIZE);

  function goToPage(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(p));
    router.push(`${pathname}?${params.toString()}`);
  }

  if (logs.length === 0) {
    return (
      <div className="rounded-lg border">
        <p className="text-sm text-muted-foreground text-center py-12">No log entries found.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-36">When</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-28">Who</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-24">Action</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-24">Type</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Asset</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Summary</th>
              <th className="px-3 py-2 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {logs.map((log) => {
              const linkFn = ENTITY_LINKS[log.entity_type];
              const href = linkFn ? linkFn(log.entity_id) : null;
              const isDeleted = !!log.deleted_at;

              return (
                <tr
                  key={log.id}
                  className={`group hover:bg-muted/20 transition-colors ${isDeleted ? 'opacity-50' : ''}`}
                >
                  <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                    <span title={formatDate(log.created_at)}>{formatTimeAgo(log.created_at)}</span>
                  </td>
                  <td className="px-3 py-2 text-xs font-medium truncate max-w-0 w-28">
                    {log.actor?.full_name ?? '—'}
                  </td>
                  <td className="px-3 py-2">
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                      {ACTION_LABELS[log.action] ?? log.action}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{log.entity_type}</td>
                  <td className="px-3 py-2 text-xs max-w-[180px] truncate">
                    {log.asset ? (
                      <Link
                        href={`/assets/${log.asset.id}`}
                        className="text-primary hover:underline font-medium"
                      >
                        {log.asset.property_name}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground max-w-xs truncate">
                    {log.summary}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <DeleteCell log={log} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{total} entries · page {page + 1} of {totalPages}</span>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              className="h-7 w-7 p-0"
              disabled={page === 0}
              onClick={() => goToPage(page - 1)}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 w-7 p-0"
              disabled={page >= totalPages - 1}
              onClick={() => goToPage(page + 1)}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
