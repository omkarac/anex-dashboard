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
import { DashboardWorkspace } from '@/components/dashboard/workspace/DashboardWorkspace';

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
      droppedCountQ: 0,
    })),
    getPipelineBoard().catch(() => ({
      stages: [],
      exits: { won: { count: 0, value: 0 }, dropped: { count: 0, value: 0 } },
      hotDeals: [],
      staleDeals: [],
    })),
    getDealAging().catch(() => ({ under7: 0, d7to30: 0, d30to60: 0, over60: 0 })),
    getAttentionSignals().catch(() => []),
    getTeamWorkload().catch(() => []),
    getRecentActivity().catch(() => []),
  ]);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
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

      {/* Customizable workspace */}
      <div className="flex-1 overflow-hidden">
        <DashboardWorkspace data={{ stats, board, aging, signals, workload, recentLogs }} />
      </div>
    </div>
  );
}
