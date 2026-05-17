import { Metadata } from 'next';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getUserProjects } from '@/lib/actions/sales/projects';
import { MeetingTypeBadge } from '@/components/sales/MeetingTypeBadge';
import { SalesProjectTabs } from '@/components/sales/SalesProjectTabs';
import type { MeetingType, MeetingCategory } from '@/lib/schemas/sales';

export const metadata: Metadata = { title: 'Meetings DAR — Anex Sales' };

export default async function MeetingsPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string; type?: string; category?: string }>;
}) {
  const params = await searchParams;
  const projects = await getUserProjects();
  const projectId = params.project ?? projects[0]?.id ?? '';
  const project = projects.find(p => p.id === projectId) ?? projects[0];

  const supabase = await createClient();
  let query = supabase
    .from('cp_meetings')
    .select(`
      id, meeting_date, meeting_type, meeting_category, rating, feedback, nri_lead,
      channel_partners(canonical_name),
      team_members!cp_meetings_sm_id_fkey(full_name)
    `)
    .eq('project_id', projectId)
    .order('meeting_date', { ascending: false })
    .limit(200);

  if (params.type) query = query.eq('meeting_type', params.type);
  if (params.category) query = query.eq('meeting_category', params.category);

  const { data } = await query;
  const rows = data ?? [];

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="border-b px-6 py-4 shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">CP Meetings (DAR)</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{project?.name} · {rows.length} meetings</p>
          </div>
          <div className="flex items-center gap-2">
            <SalesProjectTabs projects={projects} currentId={project?.id ?? ''} basePath="/sales-marketing/meetings" />
            <Link
              href={`/sales-marketing/meetings/new?project=${projectId}`}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg border border-transparent bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Log Meeting
            </Link>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="border-b px-6 py-3 flex gap-3 text-xs shrink-0 flex-wrap">
        {(['', 'obm', 'ibm'] as const).map(t => (
          <a
            key={t}
            href={`/sales-marketing/meetings?project=${projectId}${t ? `&type=${t}` : ''}`}
            className={`px-3 py-1 rounded-full border transition-colors ${
              (params.type ?? '') === t
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border hover:bg-accent'
            }`}
          >
            {t ? t.toUpperCase() : 'All'}
          </a>
        ))}
        <span className="text-border">|</span>
        {(['', 'unique', 'repeat'] as const).map(c => (
          <a
            key={c}
            href={`/sales-marketing/meetings?project=${projectId}${params.type ? `&type=${params.type}` : ''}${c ? `&category=${c}` : ''}`}
            className={`px-3 py-1 rounded-full border transition-colors ${
              (params.category ?? '') === c
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border hover:bg-accent'
            }`}
          >
            {c ? c.charAt(0).toUpperCase() + c.slice(1) : 'All'}
          </a>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
            <tr className="border-b">
              <th className="text-left px-4 py-3 font-medium">Date</th>
              <th className="text-left px-4 py-3 font-medium">SM</th>
              <th className="text-left px-4 py-3 font-medium">CP</th>
              <th className="text-left px-4 py-3 font-medium">Type</th>
              <th className="text-center px-4 py-3 font-medium">Rating</th>
              <th className="text-left px-4 py-3 font-medium">Feedback</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-12 text-muted-foreground">
                  No meetings logged yet. <Link href={`/sales-marketing/meetings/new?project=${projectId}`} className="text-primary hover:underline">Log the first one →</Link>
                </td>
              </tr>
            )}
            {rows.map((m: any) => (
              <tr key={m.id} className="border-b hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                  {new Date(m.meeting_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                </td>
                <td className="px-4 py-3 font-medium">{m.team_members?.full_name ?? '—'}</td>
                <td className="px-4 py-3">{m.channel_partners?.canonical_name ?? '—'}</td>
                <td className="px-4 py-3">
                  <MeetingTypeBadge
                    type={m.meeting_type as MeetingType}
                    category={m.meeting_category as MeetingCategory}
                  />
                </td>
                <td className="px-4 py-3 text-center">
                  {m.rating ? (
                    <span className="font-semibold text-amber-500">{'★'.repeat(m.rating)}</span>
                  ) : '—'}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground max-w-[260px] truncate">
                  {m.feedback ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
