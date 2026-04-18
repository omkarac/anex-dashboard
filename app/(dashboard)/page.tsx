import { Metadata } from 'next';
import {
  getDashboardTotals,
  getPipelineCounts,
  getTemperatureCounts,
  getDeveloperShareStats,
  getTeamWorkload,
  getRecentActivity,
} from '@/lib/queries/dashboard';
import { StatTiles } from '@/components/dashboard/stat-tiles';
import { PipelineWidget } from '@/components/dashboard/pipeline-widget';
import { TemperatureWidget } from '@/components/dashboard/temperature-widget';
import { DeveloperSharesWidget } from '@/components/dashboard/developer-shares-widget';
import { TeamWorkloadWidget } from '@/components/dashboard/team-workload-widget';
import { RecentActivityWidget } from '@/components/dashboard/recent-activity-widget';

export const metadata: Metadata = { title: 'Dashboard — Anex' };

export const revalidate = 30;

export default async function DashboardPage() {
  const [totals, pipeline, temperatures, { totalShares, top5 }, workload, recentLogs] =
    await Promise.all([
      getDashboardTotals().catch(() => ({ total: 0, active: 0, evaluatedThisMonth: 0, wonThisQuarter: 0 })),
      getPipelineCounts().catch(() => []),
      getTemperatureCounts().catch(() => []),
      getDeveloperShareStats().catch(() => ({ totalShares: 0, top5: [] })),
      getTeamWorkload().catch(() => []),
      getRecentActivity().catch(() => []),
    ]);

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="border-b px-6 py-4 shrink-0">
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Overview of the Anex pipeline.</p>
      </div>

      <div className="flex-1 p-6 flex flex-col gap-4">
        {/* Row 1 — stat tiles */}
        <StatTiles totals={totals} />

        {/* Row 2 — pipeline + temperature */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <PipelineWidget counts={pipeline} />
          </div>
          <TemperatureWidget counts={temperatures} />
        </div>

        {/* Row 3 — developer shares + team workload */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <DeveloperSharesWidget totalShares={totalShares} top5={top5} />
          <div className="lg:col-span-2">
            <TeamWorkloadWidget workload={workload} />
          </div>
        </div>

        {/* Row 4 — recent activity */}
        <RecentActivityWidget logs={recentLogs} />
      </div>
    </div>
  );
}
