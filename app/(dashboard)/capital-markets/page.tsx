import { Metadata } from 'next';
import {
  getCommandStats,
  getPipelineBoard,
  getDealAging,
  getAttentionSignals,
  getTeamWorkload,
  getRecentActivity,
} from '@/lib/queries/dashboard';
import { CommandHeader } from '@/components/dashboard/command-header';
import { PipelineBoardWidget } from '@/components/dashboard/pipeline-board';
import { AttentionPanel } from '@/components/dashboard/attention-panel';
import { DealAgingWidget } from '@/components/dashboard/deal-aging';
import { TeamBandwidth } from '@/components/dashboard/team-bandwidth';
import { RecentActivityWidget } from '@/components/dashboard/recent-activity-widget';

export const metadata: Metadata = { title: 'Capital Markets — Anex' };

export const revalidate = 30;

export default async function CapitalMarketsDashboardPage() {
  const [stats, board, aging, signals, workload, recentLogs] = await Promise.all([
    getCommandStats().catch(() => ({
      activePipelineValue: 0,
      activeCount: 0,
      hotCount: 0,
      winRate: 0,
      wonCountQ: 0,
    })),
    getPipelineBoard().catch(() => ({
      stages: [],
      exits: { won: { count: 0, value: 0 }, dropped: { count: 0, value: 0 } },
    })),
    getDealAging().catch(() => ({ under7: 0, d7to30: 0, d30to60: 0, over60: 0 })),
    getAttentionSignals().catch(() => []),
    getTeamWorkload().catch(() => []),
    getRecentActivity().catch(() => []),
  ]);

  return (
    <div className="flex flex-col h-full overflow-auto bg-background">
      {/* Page header */}
      <div className="border-b bg-card shrink-0 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-foreground tracking-tight">Capital Markets</h1>
          <p className="text-[11px] text-muted-foreground mt-0.5 font-medium">
            Anex Advisory — Deal Command Center
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-medium">
          <div className="relative flex h-1.5 w-1.5">
            <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-80" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
          </div>
          Live
        </div>
      </div>

      {/* KPI command bar */}
      <CommandHeader stats={stats} />

      {/* Main grid */}
      <div className="flex-1 p-5 flex flex-col gap-4">
        {/* Row 1: Pipeline board — full-width hero */}
        <PipelineBoardWidget board={board} />

        {/* Row 2: Attention + Aging */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3">
            <AttentionPanel signals={signals} />
          </div>
          <div className="lg:col-span-2">
            <DealAgingWidget aging={aging} />
          </div>
        </div>

        {/* Row 3: Team + Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2">
            <TeamBandwidth workload={workload} />
          </div>
          <div className="lg:col-span-3">
            <RecentActivityWidget logs={recentLogs} />
          </div>
        </div>
      </div>
    </div>
  );
}
