import { Metadata } from 'next';
import {
  getCommandStats,
  getPipelineBoard,
  getDealAging,
  getAttentionSignals,
  getTeamWorkload,
  getRecentActivity,
} from '@/lib/queries/dashboard';
import {
  getMyDay,
  getUpdateStreak,
  getClosingLoop,
  getHandoffHealth,
  getCollabGraph,
  getQuietAssetsByOwner,
  getWeekOverWeek,
  getStageThroughput,
  getTaskSla,
  getOrphanedWork,
  getEngagementCoverage,
} from '@/lib/queries/dashboard-productivity';
import { getAuthenticatedMember } from '@/lib/auth/member';
import { CommandHeader } from '@/components/dashboard/command-header';
import { DashboardWorkspace } from '@/components/dashboard/workspace/DashboardWorkspace';

export const metadata: Metadata = { title: 'Capital Markets — Anex' };

export const revalidate = 30;

export default async function CapitalMarketsDashboardPage() {
  const member = await getAuthenticatedMember();

  const [
    stats,
    board,
    aging,
    signals,
    workload,
    recentLogs,
    myDay,
    updateStreak,
    closingLoop,
    handoffHealth,
    collabGraph,
    quietByOwner,
    weekOverWeek,
    stageThroughput,
    taskSla,
    orphanedWork,
    engagementCoverage,
  ] = await Promise.all([
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
    getMyDay(member.id).catch(() => ({
      tasks_due: [],
      silent_assets: [],
      this_week_moves: [],
      updates_today: 0,
    })),
    getUpdateStreak(member.id).catch(() => ({
      current_streak: 0,
      longest_streak_30d: 0,
      days: [],
    })),
    getClosingLoop(member.id).catch(() => ({
      ball_in_your_court: [],
      waiting_on_others: [],
    })),
    getHandoffHealth().catch(() => ({
      shares: [],
      stage_medians_days: { im: 0, ff: 0, eoi: 0 },
      totals: { shared: 0, im: 0, ff: 0, eoi: 0 },
    })),
    getCollabGraph().catch(() => ({
      lone_wolf_assets: [],
      shared_assets: [],
      total_active_assets: 0,
    })),
    getQuietAssetsByOwner().catch(() => ({ rows: [] })),
    getWeekOverWeek().catch(() => ({
      metrics: [],
      week_start_iso: new Date().toISOString(),
      last_week_start_iso: new Date().toISOString(),
    })),
    getStageThroughput().catch(() => ({ stages: [] })),
    getTaskSla().catch(() => ({ rows: [], overall_pct: 0, total_tasks: 0 })),
    getOrphanedWork().catch(() => ({ items: [], total_assets: 0, total_tasks: 0 })),
    getEngagementCoverage().catch(() => ({
      active_assets: 0,
      with_engagement: 0,
      without_engagement: 0,
      coverage_pct: 0,
      uncovered_examples: [],
    })),
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
        <DashboardWorkspace
          memberName={member.full_name}
          data={{
            stats,
            board,
            aging,
            signals,
            workload,
            recentLogs,
            myDay,
            updateStreak,
            closingLoop,
            handoffHealth,
            collabGraph,
            quietByOwner,
            weekOverWeek,
            stageThroughput,
            taskSla,
            orphanedWork,
            engagementCoverage,
          }}
        />
      </div>
    </div>
  );
}
