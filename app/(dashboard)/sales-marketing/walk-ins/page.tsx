import { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getUserProjects } from '@/lib/actions/sales/projects';
import { LeadStatusBadge, getStatusRowClass } from '@/components/sales/LeadStatusBadge';
import { CpCategoryBadge } from '@/components/sales/CpCategoryBadge';
import type { LeadStatus, Config } from '@/lib/schemas/sales';

export const metadata: Metadata = { title: 'Walk-in MIS — Anex Sales' };

const CONFIG_LABELS: Record<string, string> = {
  '1bhk': '1 BHK', '2bhk': '2 BHK', '3bhk': '3 BHK',
  '2bhk_jodi': 'Jodi', 'duplex': 'Duplex', '2_3bhk': '2/3 BHK',
};

function maskMobile(mobile: string) {
  return mobile.length === 10 ? `XXXXX${mobile.slice(5)}` : mobile;
}

export default async function WalkInsPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string; status?: string; source?: string; config?: string }>;
}) {
  const params = await searchParams;
  const projects = await getUserProjects();
  const projectId = params.project ?? projects[0]?.id ?? '';
  const project = projects.find(p => p.id === projectId) ?? projects[0];

  const supabase = await createClient();
  let query = supabase
    .from('walk_ins')
    .select(`
      id, status, source, configuration, budget, created_at, latest_remark, latest_remark_date, is_active,
      clients!inner(first_name, last_name, mobile_primary),
      channel_partners(canonical_name, category),
      team_members!walk_ins_closing_sm_id_fkey(full_name),
      site_visits(visit_date, visit_number)
    `)
    .eq('project_id', projectId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(500);

  if (params.status) query = query.eq('status', params.status);
  if (params.source) query = query.eq('source', params.source);
  if (params.config) query = query.eq('configuration', params.config);

  const { data } = await query;
  const rows = data ?? [];

  const statuses: LeadStatus[] = ['hot', 'warm', 'cold', 'lost', 'booked'];

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="border-b px-6 py-4 shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Walk-in MIS</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{project?.name} · {rows.length} entries</p>
        </div>
        <Link
          href={`/sales-marketing/walk-ins/new?project=${projectId}`}
          className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg border border-transparent bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          New Walk-in
        </Link>
      </div>

      {/* Filters */}
      <div className="border-b px-6 py-3 flex gap-3 text-xs shrink-0 flex-wrap items-center">
        <a
          href={`/sales-marketing/walk-ins?project=${projectId}`}
          className={`px-3 py-1 rounded-full border transition-colors ${!params.status ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-accent'}`}
        >
          All
        </a>
        {statuses.map(s => (
          <a
            key={s}
            href={`/sales-marketing/walk-ins?project=${projectId}&status=${s}`}
            className={`px-3 py-1 rounded-full border transition-colors capitalize ${params.status === s ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-accent'}`}
          >
            {s}
          </a>
        ))}
        <span className="text-border mx-1">|</span>
        {(['cp', 'direct'] as const).map(s => (
          <a
            key={s}
            href={`/sales-marketing/walk-ins?project=${projectId}${params.status ? `&status=${params.status}` : ''}&source=${s}`}
            className={`px-3 py-1 rounded-full border transition-colors ${params.source === s ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-accent'}`}
          >
            {s.toUpperCase()}
          </a>
        ))}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
            <tr className="border-b">
              <th className="text-left px-3 py-3 font-medium">#</th>
              <th className="text-left px-3 py-3 font-medium">Client</th>
              <th className="text-left px-3 py-3 font-medium">Mobile</th>
              <th className="text-left px-3 py-3 font-medium">Config</th>
              <th className="text-left px-3 py-3 font-medium">Budget</th>
              <th className="text-left px-3 py-3 font-medium">Source</th>
              <th className="text-left px-3 py-3 font-medium">CP</th>
              <th className="text-left px-3 py-3 font-medium">Closing SM</th>
              <th className="text-left px-3 py-3 font-medium">Status</th>
              <th className="text-left px-3 py-3 font-medium">Last Remark</th>
              <th className="text-left px-3 py-3 font-medium">Last Visit</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={11} className="text-center py-12 text-muted-foreground">
                  No walk-ins yet. <Link href={`/sales-marketing/walk-ins/new?project=${projectId}`} className="text-primary hover:underline">Add the first one →</Link>
                </td>
              </tr>
            )}
            {rows.map((wi: any, i) => {
              const lastVisit = wi.site_visits?.sort((a: any, b: any) => new Date(b.visit_date).getTime() - new Date(a.visit_date).getTime())[0];
              const name = [wi.clients?.first_name, wi.clients?.last_name].filter(Boolean).join(' ') || 'Unknown';
              return (
                <tr key={wi.id} className={`border-b hover:opacity-90 transition-all ${getStatusRowClass(wi.status as LeadStatus)}`}>
                  <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                  <td className="px-3 py-2">
                    <Link href={`/sales-marketing/walk-ins/${wi.id}`} className="font-medium hover:text-primary hover:underline">
                      {name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 font-mono text-muted-foreground">
                    {maskMobile(wi.clients?.mobile_primary ?? '')}
                  </td>
                  <td className="px-3 py-2">{CONFIG_LABELS[wi.configuration ?? ''] ?? wi.configuration ?? '—'}</td>
                  <td className="px-3 py-2 text-muted-foreground">{wi.budget ?? '—'}</td>
                  <td className="px-3 py-2 uppercase font-medium text-xs">{wi.source}</td>
                  <td className="px-3 py-2 text-muted-foreground">{wi.channel_partners?.canonical_name ?? 'Direct'}</td>
                  <td className="px-3 py-2 text-muted-foreground">{wi.team_members?.full_name ?? '—'}</td>
                  <td className="px-3 py-2">
                    <LeadStatusBadge status={wi.status as LeadStatus} />
                  </td>
                  <td className="px-3 py-2 text-muted-foreground max-w-[160px] truncate">{wi.latest_remark ?? '—'}</td>
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                    {lastVisit ? new Date(lastVisit.visit_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}
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
