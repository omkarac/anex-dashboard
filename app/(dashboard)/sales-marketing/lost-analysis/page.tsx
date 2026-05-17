import { Metadata } from 'next';
import { getUserProjects } from '@/lib/actions/sales/projects';
import { getLostAnalysis } from '@/lib/actions/sales/analytics';
import { SalesProjectTabs } from '@/components/sales/SalesProjectTabs';

export const metadata: Metadata = { title: 'Lost Analysis — Anex Sales' };

const LOST_REASON_LABELS: Record<string, string> = {
  not_responding: 'Not Responding',
  budget: 'Budget',
  booked_elsewhere: 'Booked Elsewhere',
  plan_dropped: 'Plan Dropped',
  didnt_like_project: "Didn't Like Project",
  layout_issue: 'Layout Issue',
  requirement_mismatch: 'Requirement Mismatch',
  not_interested: 'Not Interested',
  general_enquiry: 'General Enquiry',
  location_issue: 'Location Issue',
  floor_issue: 'Floor Issue',
  possession_timeline: 'Possession Timeline',
  vaastu_issue: 'Vaastu Issue',
  view_issue: 'View Issue',
  other: 'Other',
};

const ACTION_TIPS: Record<string, string> = {
  not_responding: 'Consider a structured 5-touch follow-up cadence over 2 weeks before marking lost.',
  budget: 'Explore payment plan options and flexible configurations. Check if buyer financing was offered.',
  booked_elsewhere: 'Gather intelligence on which project won the booking — feeds into competitive positioning.',
  plan_dropped: 'Tag for revival follow-up in 3-6 months — life circumstances change.',
  location_issue: 'Consider digital walk-throughs and connectivity highlights in the pitch deck.',
};

export default async function LostAnalysisPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const params = await searchParams;
  const projects = await getUserProjects();
  const projectId = params.project ?? projects[0]?.id ?? '';
  const project = projects.find(p => p.id === projectId) ?? projects[0];

  const data = await getLostAnalysis(projectId);
  const totalLost = data.reduce((s, r) => s + r.total_lost, 0);
  const top3 = data.slice(0, 3);

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="border-b px-6 py-4 shrink-0 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Lost Analysis</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {project?.name} · {totalLost} total lost leads
          </p>
        </div>
        <SalesProjectTabs projects={projects} currentId={project?.id ?? ''} basePath="/sales-marketing/lost-analysis" />
      </div>

      <div className="flex-1 p-6 space-y-6">
        {/* Summary insight cards */}
        {top3.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {top3.map((r, i) => (
              <div key={r.lost_reason ?? i} className="rounded-lg border bg-red-50/40 dark:bg-red-950/10 p-4">
                <div className="text-xs text-muted-foreground mb-1">#{i + 1} reason</div>
                <div className="font-semibold text-sm">{LOST_REASON_LABELS[r.lost_reason ?? ''] ?? r.lost_reason ?? 'Other'}</div>
                <div className="text-2xl font-bold tabular-nums text-red-600 mt-1">{r.total_lost}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{r.pct_of_lost}% of lost leads</div>
                {ACTION_TIPS[r.lost_reason ?? ''] && (
                  <div className="mt-2 text-xs text-muted-foreground italic border-t pt-2">
                    {ACTION_TIPS[r.lost_reason ?? '']}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Full table */}
        <div className="rounded-lg border bg-card">
          <div className="px-4 py-3 border-b">
            <h2 className="text-sm font-semibold">Lost Reason Breakdown</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-3 font-medium">Lost Reason</th>
                  <th className="text-right px-4 py-3 font-medium">Count</th>
                  <th className="text-right px-4 py-3 font-medium">% of Lost</th>
                  <th className="text-right px-4 py-3 font-medium">CP Lost</th>
                  <th className="text-right px-4 py-3 font-medium">Direct Lost</th>
                  <th className="text-right px-4 py-3 font-medium">1BHK</th>
                  <th className="text-right px-4 py-3 font-medium">2BHK</th>
                  <th className="text-right px-4 py-3 font-medium">3BHK</th>
                  <th className="text-right px-4 py-3 font-medium">Jodi</th>
                </tr>
              </thead>
              <tbody>
                {data.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center py-8 text-muted-foreground">No lost data yet.</td>
                  </tr>
                )}
                {data.map(r => (
                  <tr key={r.lost_reason ?? 'null'} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">{LOST_REASON_LABELS[r.lost_reason ?? ''] ?? r.lost_reason ?? '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-red-600 font-semibold">{r.total_lost}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.pct_of_lost ?? 0}%</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.cp_lost}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.direct_lost}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.bhk_1}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.bhk_2}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.bhk_3}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.bhk_2_jodi}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
