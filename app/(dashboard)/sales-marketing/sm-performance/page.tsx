import { Metadata } from 'next';
import { getUserProjects } from '@/lib/actions/sales/projects';
import { getSmPerformance } from '@/lib/actions/sales/analytics';

export const metadata: Metadata = { title: 'SM Performance — Anex Sales' };

export default async function SmPerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const params = await searchParams;
  const projects = await getUserProjects();
  const projectId = params.project ?? projects[0]?.id ?? '';
  const project = projects.find(p => p.id === projectId) ?? projects[0];

  const smPerf = await getSmPerformance(projectId);

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="border-b px-6 py-4 shrink-0">
        <h1 className="text-xl font-semibold tracking-tight">SM Performance</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{project?.name}</p>
      </div>

      <div className="flex-1 p-6 space-y-6">
        {/* Walk-in Performance Table */}
        <div className="rounded-lg border bg-card">
          <div className="px-4 py-3 border-b">
            <h2 className="text-sm font-semibold">Walk-in Performance</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-3 font-medium">SM Name</th>
                  <th className="text-right px-4 py-3 font-medium">All WI</th>
                  <th className="text-right px-4 py-3 font-medium">Booked</th>
                  <th className="text-right px-4 py-3 font-medium">Warm</th>
                  <th className="text-right px-4 py-3 font-medium">Cold</th>
                  <th className="text-right px-4 py-3 font-medium">Lost</th>
                  <th className="text-right px-4 py-3 font-medium">Conv%</th>
                  <th className="text-right px-4 py-3 font-medium">CP WI</th>
                  <th className="text-right px-4 py-3 font-medium">Direct WI</th>
                </tr>
              </thead>
              <tbody>
                {smPerf.length === 0 && (
                  <tr><td colSpan={9} className="text-center py-8 text-muted-foreground">No SM data yet for this project.</td></tr>
                )}
                {smPerf.map(sm => (
                  <tr key={sm.sm_id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">{sm.full_name}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{sm.total_walkins}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-emerald-600 font-semibold">{sm.booked}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-amber-600">{sm.warm}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-blue-600">{sm.cold}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-red-500">{sm.lost}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold">{sm.conversion_pct ?? 0}%</td>
                    <td className="px-4 py-3 text-right tabular-nums">{sm.cp_walkins}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{sm.direct_walkins}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* DAR Outreach Table */}
        <div className="rounded-lg border bg-card">
          <div className="px-4 py-3 border-b">
            <h2 className="text-sm font-semibold">DAR Outreach (CP Meetings)</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-3 font-medium">SM Name</th>
                  <th className="text-right px-4 py-3 font-medium">Total Meetings</th>
                  <th className="text-right px-4 py-3 font-medium">OBMs</th>
                  <th className="text-right px-4 py-3 font-medium">Unique OBMs</th>
                  <th className="text-right px-4 py-3 font-medium">Repeat OBMs</th>
                  <th className="text-right px-4 py-3 font-medium">IBMs</th>
                  <th className="text-right px-4 py-3 font-medium">Unique IBMs</th>
                </tr>
              </thead>
              <tbody>
                {smPerf.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">No meeting data yet.</td></tr>
                )}
                {smPerf.map(sm => (
                  <tr key={sm.sm_id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">{sm.full_name}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{sm.total_meetings}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{sm.total_obms}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-teal-600">{sm.unique_obms}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-500">{sm.repeat_obms}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{sm.total_ibms}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-purple-600">{sm.unique_ibms}</td>
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
