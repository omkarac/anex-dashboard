import { Metadata } from 'next';
import { Suspense } from 'react';
import { getUserProjects } from '@/lib/actions/sales/projects';
import {
  getDashboardKpis,
  getSmPerformance,
  getConfigBreakdown,
  getCpPerformance,
  getLostAnalysis,
  getMonthlyTrend,
} from '@/lib/actions/sales/analytics';
import { KpiTile } from '@/components/sales/KpiTile';
import { CpCategoryBadge } from '@/components/sales/CpCategoryBadge';

export const metadata: Metadata = { title: 'Sales Dashboard — Anex' };

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

const CONFIG_LABELS: Record<string, string> = {
  '1bhk': '1 BHK', '2bhk': '2 BHK', '3bhk': '3 BHK',
  '2bhk_jodi': '2BHK Jodi', 'duplex': 'Duplex', '2_3bhk': '2/3 BHK', 'commercial': 'Commercial',
};

export default async function SalesDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const params = await searchParams;
  const projects = await getUserProjects();

  if (projects.length === 0) {
    return (
      <div className="flex flex-col h-full overflow-auto">
        <div className="border-b px-6 py-4 shrink-0">
          <h1 className="text-xl font-semibold tracking-tight">Sales Dashboard</h1>
        </div>
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          No projects assigned. Contact your administrator.
        </div>
      </div>
    );
  }

  const projectId = params.project ?? projects[0].id;
  const project = projects.find(p => p.id === projectId) ?? projects[0];

  const [kpis, smPerf, configBreakdown, cpPerf, lostAnalysis, monthlyTrend] = await Promise.all([
    getDashboardKpis(project.id),
    getSmPerformance(project.id),
    getConfigBreakdown(project.id),
    getCpPerformance(project.id),
    getLostAnalysis(project.id),
    getMonthlyTrend(project.id),
  ]);

  const p1 = cpPerf.filter(c => c.computed_priority === 'p1').length;
  const p2 = cpPerf.filter(c => c.computed_priority === 'p2').length;
  const p3 = cpPerf.filter(c => c.computed_priority === 'p3').length;

  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* Header */}
      <div className="border-b px-6 py-4 shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Sales Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{project.name} · {project.location}</p>
        </div>
        <div className="flex gap-2">
          {projects.map(p => (
            <a
              key={p.id}
              href={`/sales-marketing?project=${p.id}`}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                p.id === project.id
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:bg-accent'
              }`}
            >
              {p.name.split(' ')[0]}
            </a>
          ))}
        </div>
      </div>

      <div className="flex-1 p-6 space-y-6">
        {/* ROW 1: KPI Tiles */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiTile label="CP Walk-ins"    value={kpis.cpWalkins}     color="navy"   />
          <KpiTile label="Bookings"       value={kpis.booked}        color="green"  subtitle={`${kpis.convPct}% conv.`} />
          <KpiTile label="Warm Leads"     value={kpis.warm}          color="gold"   />
          <KpiTile label="Lost"           value={kpis.lost}          color="red"    />
          <KpiTile label="Unique OBMs"    value={kpis.uniqueObms}    color="teal"   />
          <KpiTile label="Total IBMs"     value={kpis.totalIbms}     color="purple" />
        </div>

        {/* ROW 2: SM Performance + Config Demand */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* SM Performance */}
          <div className="rounded-lg border bg-card">
            <div className="px-4 py-3 border-b">
              <h2 className="text-sm font-semibold">SM Performance</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left px-3 py-2 font-medium">SM</th>
                    <th className="text-right px-3 py-2 font-medium">WI</th>
                    <th className="text-right px-3 py-2 font-medium">Booked</th>
                    <th className="text-right px-3 py-2 font-medium">Warm</th>
                    <th className="text-right px-3 py-2 font-medium">Lost</th>
                    <th className="text-right px-3 py-2 font-medium">Conv%</th>
                  </tr>
                </thead>
                <tbody>
                  {smPerf.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-4 text-muted-foreground">No data</td></tr>
                  )}
                  {smPerf.map(sm => (
                    <tr key={sm.sm_id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-3 py-2 font-medium">{sm.full_name}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{sm.total_walkins}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-emerald-600">{sm.booked}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-amber-600">{sm.warm}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-red-500">{sm.lost}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{sm.conversion_pct ?? 0}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Config Demand */}
          <div className="rounded-lg border bg-card">
            <div className="px-4 py-3 border-b">
              <h2 className="text-sm font-semibold">Configuration Demand</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left px-3 py-2 font-medium">Config</th>
                    <th className="text-right px-3 py-2 font-medium">Total</th>
                    <th className="text-right px-3 py-2 font-medium">Booked</th>
                    <th className="text-right px-3 py-2 font-medium">Conv%</th>
                    <th className="text-right px-3 py-2 font-medium">% of Total</th>
                  </tr>
                </thead>
                <tbody>
                  {configBreakdown.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-4 text-muted-foreground">No data</td></tr>
                  )}
                  {configBreakdown.map(c => (
                    <tr key={c.configuration ?? 'null'} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-3 py-2 font-medium">{CONFIG_LABELS[c.configuration ?? ''] ?? c.configuration ?? '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{c.total}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-emerald-600">{c.booked}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{c.conversion_pct ?? 0}%</td>
                      <td className="px-3 py-2 text-right tabular-nums">{c.pct_of_total ?? 0}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ROW 3: CP Priority Summary + Top Lost Reasons */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* CP Priority */}
          <div className="rounded-lg border bg-card">
            <div className="px-4 py-3 border-b">
              <h2 className="text-sm font-semibold">CP Priority Breakdown</h2>
            </div>
            <div className="p-4 grid grid-cols-3 gap-3">
              {[
                { label: 'P1 (10+ WI)', count: p1, color: 'text-amber-600 bg-amber-50 border-amber-200' },
                { label: 'P2 (5-9 WI)', count: p2, color: 'text-blue-600 bg-blue-50 border-blue-200' },
                { label: 'P3 (1-4 WI)', count: p3, color: 'text-slate-600 bg-slate-50 border-slate-200' },
              ].map(tier => (
                <div key={tier.label} className={`rounded-lg border p-3 text-center ${tier.color}`}>
                  <div className="text-2xl font-bold tabular-nums">{tier.count}</div>
                  <div className="text-xs mt-0.5">{tier.label}</div>
                </div>
              ))}
            </div>
            <div className="px-4 pb-3">
              <a href={`/sales-marketing/cp-review?project=${project.id}`} className="text-xs text-primary hover:underline">
                View full CP review →
              </a>
            </div>
          </div>

          {/* Top Lost Reasons */}
          <div className="rounded-lg border bg-card">
            <div className="px-4 py-3 border-b">
              <h2 className="text-sm font-semibold">Top Lost Reasons</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left px-3 py-2 font-medium">Reason</th>
                    <th className="text-right px-3 py-2 font-medium">Count</th>
                    <th className="text-right px-3 py-2 font-medium">% of Lost</th>
                  </tr>
                </thead>
                <tbody>
                  {lostAnalysis.length === 0 && (
                    <tr><td colSpan={3} className="text-center py-4 text-muted-foreground">No lost data</td></tr>
                  )}
                  {lostAnalysis.slice(0, 7).map(r => (
                    <tr key={r.lost_reason ?? 'null'} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-3 py-2">{LOST_REASON_LABELS[r.lost_reason ?? ''] ?? r.lost_reason ?? '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.total_lost}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{r.pct_of_lost ?? 0}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ROW 4: Monthly Trend */}
        <div className="rounded-lg border bg-card">
          <div className="px-4 py-3 border-b">
            <h2 className="text-sm font-semibold">Monthly Trend</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-3 py-2 font-medium sticky left-0 bg-muted/40">Month</th>
                  <th className="text-right px-3 py-2 font-medium">Total WI</th>
                  <th className="text-right px-3 py-2 font-medium">CP WI</th>
                  <th className="text-right px-3 py-2 font-medium">Direct WI</th>
                  <th className="text-right px-3 py-2 font-medium">Bookings</th>
                </tr>
              </thead>
              <tbody>
                {monthlyTrend.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-4 text-muted-foreground">No monthly data yet</td></tr>
                )}
                {monthlyTrend.map(m => (
                  <tr key={m.month_sort} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-3 py-2 font-medium">{m.month_label}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{m.total_walkins}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{m.cp_walkins}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{m.direct_walkins}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-emerald-600 font-medium">{m.bookings}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ROW 5: Top 15 CPs × Config */}
        <div className="rounded-lg border bg-card">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <h2 className="text-sm font-semibold">Top CP Performance</h2>
            <a href={`/sales-marketing/cp-review?project=${project.id}`} className="text-xs text-primary hover:underline">
              Full table →
            </a>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-3 py-2 font-medium">#</th>
                  <th className="text-left px-3 py-2 font-medium">CP Firm</th>
                  <th className="text-left px-3 py-2 font-medium">Cat</th>
                  <th className="text-right px-3 py-2 font-medium">WI</th>
                  <th className="text-right px-3 py-2 font-medium">Bkd</th>
                  <th className="text-right px-3 py-2 font-medium">1BHK</th>
                  <th className="text-right px-3 py-2 font-medium">2BHK</th>
                  <th className="text-right px-3 py-2 font-medium">3BHK</th>
                  <th className="text-right px-3 py-2 font-medium">Conv%</th>
                  <th className="text-right px-3 py-2 font-medium">Priority</th>
                </tr>
              </thead>
              <tbody>
                {cpPerf.length === 0 && (
                  <tr><td colSpan={10} className="text-center py-4 text-muted-foreground">No CP data yet</td></tr>
                )}
                {cpPerf.slice(0, 15).map((cp, i) => (
                  <tr key={cp.cp_id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-2">
                      <a href={`/sales-marketing/channel-partners/${cp.cp_id}`} className="font-medium hover:text-primary hover:underline">
                        {cp.canonical_name}
                      </a>
                    </td>
                    <td className="px-3 py-2">
                      <CpCategoryBadge category={cp.category as 'icp' | 'rcp' | 'cp'} />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">{cp.total_walkins}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-emerald-600">{cp.booked}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{cp.bhk_1}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{cp.bhk_2}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{cp.bhk_3}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{cp.conversion_pct ?? 0}%</td>
                    <td className="px-3 py-2 text-right">
                      {cp.computed_priority && (
                        <span className={`font-semibold uppercase text-xs ${
                          cp.computed_priority === 'p1' ? 'text-amber-600' :
                          cp.computed_priority === 'p2' ? 'text-blue-600' : 'text-slate-500'
                        }`}>{cp.computed_priority}</span>
                      )}
                    </td>
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
