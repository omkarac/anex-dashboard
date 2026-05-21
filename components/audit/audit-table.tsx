'use client';

import { useState, useTransition, Fragment } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Trash2, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { deleteActivityLog } from '@/lib/actions/logs';
import { formatTimeAgo, formatDateTime } from '@/lib/utils/formatters';
import { actionLabel, actionColor, VERTICAL_SHORT, VERTICAL_COLORS } from '@/lib/enums/audit';
import { verticalForEntity, type LogEntry } from '@/lib/queries/logs';
import { EventDetail } from '@/components/audit/diff-viewer';

const PAGE_SIZE = 50;

function DeleteCell({ log }: { log: LogEntry }) {
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
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
          className="h-7 text-xs w-32 px-1.5"
          onKeyDown={(e) => {
            if (e.key === 'Escape') { setConfirming(false); setReason(''); setError(null); }
          }}
        />
        <Button
          size="sm"
          variant="destructive"
          className="h-7 px-2 text-xs"
          disabled={isPending || !reason.trim()}
          onClick={() =>
            startTransition(async () => {
              const result = await deleteActivityLog(log.id, reason);
              if (result.ok) {
                setConfirming(false);
                setReason('');
                router.refresh();
              } else {
                setError(result.error);
              }
            })
          }
        >
          Confirm
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-1.5 text-xs"
          onClick={() => { setConfirming(false); setReason(''); setError(null); }}
        >
          Cancel
        </Button>
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
    );
  }

  return (
    <button
      onClick={(e) => { e.stopPropagation(); setConfirming(true); }}
      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
      title="Strike from audit record"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}

type Props = {
  logs: LogEntry[];
  total: number;
  page: number;
  canDelete: boolean;
};

export function AuditTable({ logs, total, page, canDelete }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [expanded, setExpanded] = useState<string | null>(null);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  function goToPage(p: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(p));
    router.push(`${pathname}?${params.toString()}`);
  }

  if (logs.length === 0) {
    return (
      <div className="rounded-lg border">
        <p className="text-sm text-muted-foreground text-center py-12">No audit events match these filters.</p>
      </div>
    );
  }

  const colSpan = canDelete ? 8 : 7;

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="w-8" />
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-32">When</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-28">Who</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-16">Area</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-24">Action</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground w-44">Entity</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Summary</th>
              {canDelete && <th className="px-3 py-2 w-10" />}
            </tr>
          </thead>
          <tbody className="divide-y">
            {logs.map((log) => {
              const isDeleted = !!log.deleted_at;
              const isOpen = expanded === log.id;
              const vert = verticalForEntity(log.entity_type);

              return (
                <Fragment key={log.id}>
                  <tr
                    className={`group hover:bg-muted/20 transition-colors cursor-pointer ${isDeleted ? 'opacity-50' : ''}`}
                    onClick={() => setExpanded(isOpen ? null : log.id)}
                  >
                    <td className="pl-3 text-muted-foreground">
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                      <span title={formatDateTime(log.created_at)}>{formatTimeAgo(log.created_at)}</span>
                    </td>
                    <td className="px-3 py-2 text-xs font-medium truncate max-w-0 w-28">
                      {log.actor?.full_name ?? '—'}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold ${VERTICAL_COLORS[vert]}`}>
                        {VERTICAL_SHORT[vert]}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium ${actionColor(log.action)}`}>
                        {actionLabel(log.action)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs max-w-[180px] truncate">
                      {log.asset ? (
                        <Link
                          href={`/capital-markets/assets/${log.asset.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-primary hover:underline font-medium"
                        >
                          {log.asset.property_name}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">{log.entity_type}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground max-w-xs truncate">
                      {log.summary}
                    </td>
                    {canDelete && (
                      <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                        <DeleteCell log={log} />
                      </td>
                    )}
                  </tr>
                  {isOpen && (
                    <tr className="bg-muted/10">
                      <td colSpan={colSpan} className="px-4 py-3">
                        <EventDetail
                          diff={log.diff}
                          entityType={log.entity_type}
                          entityId={log.entity_id}
                          createdAt={log.created_at}
                          summary={log.summary}
                          deletedAt={log.deleted_at}
                          deleteReason={log.delete_reason}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{total} events · page {page + 1} of {totalPages}</span>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" className="h-7 w-7 p-0" disabled={page === 0} onClick={() => goToPage(page - 1)}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="outline" className="h-7 w-7 p-0" disabled={page >= totalPages - 1} onClick={() => goToPage(page + 1)}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
