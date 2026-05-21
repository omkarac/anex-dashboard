import { Metadata } from 'next';
import { Suspense } from 'react';
import { getAuthenticatedMember } from '@/lib/auth/member';
import { listLogs, getLogFilterOptions, type AuditVertical, type LogFilters } from '@/lib/queries/logs';
import { getAuditStats, getAuditAnalytics, getFlaggedEvents } from '@/lib/queries/audit';
import { AuditKpiStrip } from '@/components/audit/audit-kpi-strip';
import { AuditFilters } from '@/components/audit/audit-filters';
import { AuditTabs, type AuditView } from '@/components/audit/audit-tabs';
import { AuditTable } from '@/components/audit/audit-table';
import { AuditTimeline } from '@/components/audit/audit-timeline';
import { AuditAnalyticsView } from '@/components/audit/audit-analytics';
import { NeedsAttention } from '@/components/audit/needs-attention';
import { AuditExport } from '@/components/audit/audit-export';

export const metadata: Metadata = { title: 'Audit Room — Anex' };

const VALID_VIEWS: AuditView[] = ['table', 'timeline', 'analytics', 'flags'];

export default async function AuditRoomPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;

  const member = await getAuthenticatedMember();
  const canDelete = member.role === 'admin';

  const view: AuditView = VALID_VIEWS.includes(params.view as AuditView) ? (params.view as AuditView) : 'table';
  const vertical: AuditVertical = (['all', 'capital_markets', 'sales_marketing'].includes(params.vertical)
    ? params.vertical
    : 'all') as AuditVertical;
  const page = Math.max(0, parseInt(params.page ?? '0', 10) || 0);

  const filters: LogFilters = {
    q: params.q || undefined,
    actor_id: params.actor_id || undefined,
    action: params.action || undefined,
    entity_type: params.entity_type || undefined,
    from: params.from || undefined,
    to: params.to || undefined,
    show_deleted: params.deleted === '1',
    page,
    vertical,
  };

  const filterVertical = vertical === 'all' ? undefined : vertical;

  // Always fetch: KPIs, filter options, and flagged (drives the tab badge).
  const [stats, filterOptions, flagged] = await Promise.all([
    getAuditStats(filters).catch(() => ({
      today: 0, last7: 0, totalInView: 0, activeUsers: 0, deletions: 0, topEntity: null,
    })),
    getLogFilterOptions(filterVertical).catch(() => ({ actors: [], actions: [], entityTypes: [] })),
    getFlaggedEvents(filters).catch(() => []),
  ]);

  // View-specific data.
  const listResult = (view === 'table' || view === 'timeline')
    ? await listLogs(filters).catch(() => ({ logs: [], total: 0, page: 0 }))
    : { logs: [], total: 0, page: 0 };

  const analytics = view === 'analytics'
    ? await getAuditAnalytics(filters).catch(() => ({ timeSeries: [], actions: [], leaderboard: [], totalEvents: 0 }))
    : { timeSeries: [], actions: [], leaderboard: [], totalEvents: 0 };

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Audit Room</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Tamper-evident record of every action across all verticals.
          </p>
        </div>
        <div className="print:hidden">
          <Suspense>
            <AuditExport />
          </Suspense>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 flex flex-col gap-5">
        <AuditKpiStrip stats={stats} />

        <Suspense>
          <AuditTabs active={view} flagCount={flagged.length} />
        </Suspense>

        <div className="print:hidden">
          <Suspense>
            <AuditFilters
              actors={filterOptions.actors}
              actions={filterOptions.actions}
              entityTypes={filterOptions.entityTypes}
            />
          </Suspense>
        </div>

        {view === 'table' && (
          <Suspense>
            <AuditTable logs={listResult.logs} total={listResult.total} page={page} canDelete={canDelete} />
          </Suspense>
        )}

        {view === 'timeline' && <AuditTimeline logs={listResult.logs} />}

        {view === 'analytics' && <AuditAnalyticsView analytics={analytics} />}

        {view === 'flags' && <NeedsAttention events={flagged} />}
      </div>
    </div>
  );
}
