import { Metadata } from 'next';
import { Suspense } from 'react';
import { listLogs, getLogFilterOptions } from '@/lib/queries/logs';
import { LogFilters } from '@/components/logs/log-filters';
import { LogTable } from '@/components/logs/log-table';

export const metadata: Metadata = { title: 'Activity Logs — Anex' };

export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;

  const page = Math.max(0, parseInt(params.page ?? '0', 10) || 0);
  const filters = {
    q: params.q || undefined,
    actor_id: params.actor_id || undefined,
    action: params.action || undefined,
    entity_type: params.entity_type || undefined,
    from: params.from || undefined,
    to: params.to || undefined,
    show_deleted: params.deleted === '1',
    page,
  };

  const [{ logs, total }, filterOptions] = await Promise.all([
    listLogs(filters).catch(() => ({ logs: [], total: 0, page: 0 })),
    getLogFilterOptions().catch(() => ({ actors: [], actions: [], entityTypes: [] })),
  ]);

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4">
        <h1 className="text-xl font-semibold tracking-tight">Activity Logs</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Audit trail of all actions in the system.
        </p>
      </div>

      <div className="flex-1 overflow-auto p-6 flex flex-col gap-4">
        <Suspense>
          <LogFilters
            actors={filterOptions.actors}
            actions={filterOptions.actions}
            entityTypes={filterOptions.entityTypes}
          />
        </Suspense>

        <Suspense>
          <LogTable logs={logs} total={total} page={page} />
        </Suspense>
      </div>
    </div>
  );
}
