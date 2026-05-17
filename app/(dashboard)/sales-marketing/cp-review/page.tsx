import { Metadata } from 'next';
import { getUserProjects } from '@/lib/actions/sales/projects';
import { getCpPerformance } from '@/lib/actions/sales/analytics';
import { CpCategoryBadge } from '@/components/sales/CpCategoryBadge';
import { SalesProjectTabs } from '@/components/sales/SalesProjectTabs';

export const metadata: Metadata = { title: 'CP Review — Anex Sales' };

export default async function CpReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string; priority?: string; category?: string }>;
}) {
  const params = await searchParams;
  const projects = await getUserProjects();
  const projectId = params.project ?? projects[0]?.id ?? '';
  const project = projects.find(p => p.id === projectId) ?? projects[0];

  let data = await getCpPerformance(projectId);

  if (params.priority) data = data.filter(c => c.computed_priority === params.priority);
  if (params.category) data = data.filter(c => c.category === params.category);

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="border-b px-6 py-4 shrink-0 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">CP Review</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{project?.name} · {data.length} channel partners</p>
        </div>
        <SalesProjectTabs projects={projects} currentId={project?.id ?? ''} basePath="/sales-marketing/cp-review" />
      </div>

      {/* Filters */}
      <div className="border-b px-6 py-3 flex gap-3 text-xs shrink-0 flex-wrap">
        {(['', 'p1', 'p2', 'p3'] as const).map(p => (
          <a
            key={p}
            href={`/sales-marketing/cp-review?project=${projectId}${p ? `&priority=${p}` : ''}`}
            className={`px-3 py-1 rounded-full border transition-colors ${
              (params.priority ?? '') === p
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border hover:bg-accent'
            }`}
          >
            {p ? p.toUpperCase() : 'All Priority'}
          </a>
        ))}
        <span className="text-border">|</span>
        {(['', 'icp', 'rcp', 'cp'] as const).map(c => (
          <a
            key={c}
            href={`/sales-marketing/cp-review?project=${projectId}${params.priority ? `&priority=${params.priority}` : ''}${c ? `&category=${c}` : ''}`}
            className={`px-3 py-1 rounded-full border transition-colors ${
              (params.category ?? '') === c
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border hover:bg-accent'
            }`}
          >
            {c ? c.toUpperCase() : 'All Category'}
          </a>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
            <tr className="border-b">
              <th className="text-left px-3 py-3 font-medium w-8">#</th>
              <th className="text-left px-3 py-3 font-medium">CP Firm</th>
              <th className="text-left px-3 py-3 font-medium">Cat</th>
              <th className="text-right px-3 py-3 font-medium">Walk-ins</th>
              <th className="text-right px-3 py-3 font-medium">Booked</th>
              <th className="text-right px-3 py-3 font-medium">Warm</th>
              <th className="text-right px-3 py-3 font-medium">Cold</th>
              <th className="text-right px-3 py-3 font-medium">Lost</th>
              <th className="text-right px-3 py-3 font-medium">1BHK</th>
              <th className="text-right px-3 py-3 font-medium">2BHK</th>
              <th className="text-right px-3 py-3 font-medium">3BHK</th>
              <th className="text-right px-3 py-3 font-medium">Jodi</th>
              <th className="text-right px-3 py-3 font-medium">Revisits</th>
              <th className="text-right px-3 py-3 font-medium">OBMs</th>
              <th className="text-right px-3 py-3 font-medium">IBMs</th>
              <th className="text-right px-3 py-3 font-medium">Conv%</th>
              <th className="text-right px-3 py-3 font-medium">Priority</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && (
              <tr>
                <td colSpan={17} className="text-center py-12 text-muted-foreground">
                  No CP performance data yet.
                </td>
              </tr>
            )}
            {data.map((cp, i) => (
              <tr key={cp.cp_id} className="border-b hover:bg-muted/20 transition-colors">
                <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                <td className="px-3 py-2">
                  <a href={`/sales-marketing/channel-partners/${cp.cp_id}?project=${projectId}`} className="font-medium hover:text-primary hover:underline">
                    {cp.canonical_name}
                  </a>
                </td>
                <td className="px-3 py-2">
                  <CpCategoryBadge category={cp.category as 'icp' | 'rcp' | 'cp'} />
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold">{cp.total_walkins}</td>
                <td className="px-3 py-2 text-right tabular-nums text-emerald-600 font-semibold">{cp.booked}</td>
                <td className="px-3 py-2 text-right tabular-nums text-amber-600">{cp.warm}</td>
                <td className="px-3 py-2 text-right tabular-nums text-blue-500">{cp.cold}</td>
                <td className="px-3 py-2 text-right tabular-nums text-red-500">{cp.lost}</td>
                <td className="px-3 py-2 text-right tabular-nums">{cp.bhk_1}</td>
                <td className="px-3 py-2 text-right tabular-nums">{cp.bhk_2}</td>
                <td className="px-3 py-2 text-right tabular-nums">{cp.bhk_3}</td>
                <td className="px-3 py-2 text-right tabular-nums">{cp.bhk_2_jodi}</td>
                <td className="px-3 py-2 text-right tabular-nums">{cp.revisit_count}</td>
                <td className="px-3 py-2 text-right tabular-nums">{cp.obm_count}</td>
                <td className="px-3 py-2 text-right tabular-nums">{cp.ibm_count}</td>
                <td className="px-3 py-2 text-right tabular-nums">{cp.conversion_pct ?? 0}%</td>
                <td className="px-3 py-2 text-right">
                  {cp.computed_priority && (
                    <span className={`font-bold text-xs uppercase ${
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
  );
}
