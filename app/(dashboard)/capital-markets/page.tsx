import { Metadata } from 'next';
import {
  getCommandStats,
  getPipelineWithValue,
  getDealAging,
  getAttentionSignals,
  getTeamWorkload,
  getRecentActivity,
} from '@/lib/queries/dashboard';
import { CommandHeader } from '@/components/dashboard/command-header';
import { PipelineFunnel } from '@/components/dashboard/pipeline-funnel';
import { AttentionPanel } from '@/components/dashboard/attention-panel';
import { DealAgingWidget } from '@/components/dashboard/deal-aging';
import { TeamBandwidth } from '@/components/dashboard/team-bandwidth';
import { RecentActivityWidget } from '@/components/dashboard/recent-activity-widget';

export const metadata: Metadata = { title: 'Capital Markets — Anex' };

export const revalidate = 30;

export default async function CapitalMarketsDashboardPage() {
  const [stats, pipeline, aging, signals, workload, recentLogs] = await Promise.all([
    getCommandStats().catch(() => ({
      activePipelineValue: 0,
      activeCount: 0,
      hotCount: 0,
      winRate: 0,
      wonCountQ: 0,
    })),
    getPipelineWithValue().catch(() => []),
    getDealAging().catch(() => ({ under7: 0, d7to30: 0, d30to60: 0, over60: 0 })),
    getAttentionSignals().catch(() => []),
    getTeamWorkload().catch(() => []),
    getRecentActivity().catch(() => []),
  ]);

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="border-b px-6 py-4 shrink-0">
        <h1 className="text-xl font-semibold tracking-tight">Capital Markets</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Pipeline overview — Anex Advisory</p>
      </div>

      <CommandHeader stats={stats} />

      <div className="flex-1 p-6 flex flex-col gap-4">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3">
            <PipelineFunnel stages={pipeline} />
          </div>
          <div className="lg:col-span-2">
            <AttentionPanel signals={signals} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2">
            <DealAgingWidget aging={aging} />
          </div>
          <div className="lg:col-span-3">
            <TeamBandwidth workload={workload} />
          </div>
        </div>

        <RecentActivityWidget logs={recentLogs} />
      </div>
    </div>
  );
}
