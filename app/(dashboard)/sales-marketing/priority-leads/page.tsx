import { Metadata } from 'next';
import { getUserProjects } from '@/lib/actions/sales/projects';
import { getPriorityLeads } from '@/lib/actions/sales/analytics';
import { LeadStatusBadge } from '@/components/sales/LeadStatusBadge';
import { SalesProjectTabs } from '@/components/sales/SalesProjectTabs';
import type { LeadStatus, Config } from '@/lib/schemas/sales';

export const metadata: Metadata = { title: 'Priority Leads — Anex Sales' };

const PRIORITY_LABELS: Record<number, { label: string; classes: string }> = {
  5: { label: 'P5', classes: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  4: { label: 'P4', classes: 'bg-amber-100 text-amber-700 border-amber-300' },
  3: { label: 'P3', classes: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  2: { label: 'P2', classes: 'bg-blue-100 text-blue-700 border-blue-300' },
  1: { label: 'P1', classes: 'bg-gray-100 text-gray-600 border-gray-200' },
};

const CONFIG_LABELS: Record<string, string> = {
  '1bhk': '1 BHK', '2bhk': '2 BHK', '3bhk': '3 BHK',
  '2bhk_jodi': '2BHK Jodi', 'duplex': 'Duplex', '2_3bhk': '2/3 BHK',
};

function maskMobile(mobile: string) {
  return mobile.length === 10 ? `XXXXX${mobile.slice(5)}` : mobile;
}

export default async function PriorityLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string; status?: string; config?: string }>;
}) {
  const params = await searchParams;
  const projects = await getUserProjects();
  const projectId = params.project ?? projects[0]?.id ?? '';

  const leads = await getPriorityLeads(projectId);

  let filtered = leads;
  if (params.status) filtered = filtered.filter(l => l.status === params.status);
  if (params.config) filtered = filtered.filter(l => l.configuration === params.config);

  const project = projects.find(p => p.id === projectId) ?? projects[0];

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="border-b px-6 py-4 shrink-0 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Priority Leads</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {project?.name} · {filtered.length} follow-up leads
          </p>
        </div>
        <SalesProjectTabs projects={projects} currentId={project?.id ?? ''} basePath="/sales-marketing/priority-leads" />
      </div>

      {/* Filters */}
      <div className="border-b px-6 py-3 flex gap-3 text-sm shrink-0 flex-wrap">
        {(['', 'warm', 'cold', 'booked'] as const).map(s => (
          <a
            key={s}
            href={`/sales-marketing/priority-leads?project=${projectId}${s ? `&status=${s}` : ''}`}
            className={`px-3 py-1 rounded-full border transition-colors ${
              (params.status ?? '') === s
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border hover:bg-accent'
            }`}
          >
            {s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All'}
          </a>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
            <tr className="border-b">
              <th className="text-left px-4 py-3 font-medium w-12">Score</th>
              <th className="text-left px-4 py-3 font-medium">Client</th>
              <th className="text-left px-4 py-3 font-medium">Mobile</th>
              <th className="text-left px-4 py-3 font-medium">Config</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">CP</th>
              <th className="text-left px-4 py-3 font-medium">SM</th>
              <th className="text-left px-4 py-3 font-medium">Last Visit</th>
              <th className="text-left px-4 py-3 font-medium">Remark</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center py-12 text-muted-foreground">
                  No priority leads found.
                </td>
              </tr>
            )}
            {filtered.map(lead => {
              const pConfig = PRIORITY_LABELS[lead.priority_score] ?? PRIORITY_LABELS[1];
              const name = [lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'Unknown';
              return (
                <tr key={lead.walk_in_id} className="border-b hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-bold ${pConfig.classes}`}>
                      {pConfig.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <a href={`/sales-marketing/walk-ins/${lead.walk_in_id}`} className="font-medium hover:text-primary hover:underline">
                      {name}
                    </a>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {maskMobile(lead.mobile_primary)}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {CONFIG_LABELS[lead.configuration ?? ''] ?? lead.configuration ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <LeadStatusBadge status={lead.status as LeadStatus} />
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{lead.cp_name ?? 'Direct'}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{lead.closing_sm ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {lead.last_visit_date ? new Date(lead.last_visit_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}
                    {lead.visit_number && lead.visit_number > 1 && (
                      <span className="ml-1 text-xs text-blue-500">v{lead.visit_number}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-[200px] truncate">
                    {lead.latest_remark ?? '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
