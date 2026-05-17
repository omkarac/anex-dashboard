import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CpCategoryBadge } from '@/components/sales/CpCategoryBadge';
import { CpStagePill } from '@/components/sales/CpStagePill';
import { LeadStatusBadge } from '@/components/sales/LeadStatusBadge';
import { MeetingTypeBadge } from '@/components/sales/MeetingTypeBadge';
import type { LeadStatus, MeetingType, MeetingCategory } from '@/lib/schemas/sales';

export const metadata: Metadata = { title: 'CP Detail — Anex Sales' };

export default async function CpDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ project?: string; tab?: string }>;
}) {
  const { id } = await params;
  const { project: projectId, tab = 'meetings' } = await searchParams;

  const supabase = await createClient();

  const { data: cp } = await supabase
    .from('channel_partners')
    .select('*')
    .eq('id', id)
    .single();

  if (!cp) notFound();

  // Fetch meeting history for this project
  const { data: meetings } = await supabase
    .from('cp_meetings')
    .select('id, meeting_date, meeting_type, meeting_category, rating, feedback, team_members!cp_meetings_sm_id_fkey(full_name)')
    .eq('cp_id', id)
    .order('meeting_date', { ascending: false })
    .limit(50);

  // Fetch walk-ins sent by this CP
  const { data: walkins } = await supabase
    .from('walk_ins')
    .select('id, status, configuration, budget, created_at, clients(first_name, last_name, mobile_primary)')
    .eq('cp_id', id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(50);

  const totalWalkins = walkins?.length ?? 0;
  const booked = walkins?.filter(w => w.status === 'booked').length ?? 0;
  const lastMeeting = meetings?.[0];

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="border-b px-6 py-4 shrink-0">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-semibold tracking-tight">{cp.canonical_name}</h1>
              <CpCategoryBadge category={cp.category as 'icp' | 'rcp' | 'cp'} />
              <CpStagePill stage={cp.stage as 'prospect' | 'active' | 'inactive'} />
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              {cp.mobile_primary && <span className="font-mono">{cp.mobile_primary}</span>}
              {cp.zone && <span className="capitalize">{cp.zone.replace(/_/g, ' ')}</span>}
              {cp.firm_type && <span className="capitalize">{cp.firm_type.replace(/_/g, ' ')}</span>}
            </div>
          </div>
          <div className={`text-xs px-2 py-1 rounded-full border ${cp.is_approved ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
            {cp.is_approved ? 'Approved' : 'Pending Approval'}
          </div>
        </div>
      </div>

      {/* Activity Summary */}
      <div className="border-b px-6 py-3 shrink-0">
        <div className="flex gap-6 text-sm">
          <div><span className="text-2xl font-bold tabular-nums">{totalWalkins}</span> <span className="text-muted-foreground text-xs">Walk-ins</span></div>
          <div><span className="text-2xl font-bold tabular-nums text-emerald-600">{booked}</span> <span className="text-muted-foreground text-xs">Booked</span></div>
          <div><span className="text-2xl font-bold tabular-nums">{meetings?.length ?? 0}</span> <span className="text-muted-foreground text-xs">Meetings</span></div>
          {lastMeeting && (
            <div className="text-muted-foreground text-xs self-end">
              Last meeting: {new Date(lastMeeting.meeting_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b px-6 flex gap-6 shrink-0 text-sm">
        {['meetings', 'walkins'].map(t => (
          <a
            key={t}
            href={`/sales-marketing/channel-partners/${id}?project=${projectId ?? ''}&tab=${t}`}
            className={`py-3 border-b-2 transition-colors capitalize ${tab === t ? 'border-primary text-primary font-medium' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            {t === 'meetings' ? 'Meeting History' : 'Walk-ins Sent'}
          </a>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto">
        {tab === 'meetings' && (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
              <tr className="border-b">
                <th className="text-left px-4 py-3 font-medium">Date</th>
                <th className="text-left px-4 py-3 font-medium">SM</th>
                <th className="text-left px-4 py-3 font-medium">Type</th>
                <th className="text-center px-4 py-3 font-medium">Rating</th>
                <th className="text-left px-4 py-3 font-medium">Feedback</th>
              </tr>
            </thead>
            <tbody>
              {(meetings ?? []).length === 0 && (
                <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">No meetings logged yet.</td></tr>
              )}
              {(meetings ?? []).map((m: any) => (
                <tr key={m.id} className="border-b hover:bg-muted/20">
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">
                    {new Date(m.meeting_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                  </td>
                  <td className="px-4 py-3">{m.team_members?.full_name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <MeetingTypeBadge type={m.meeting_type as MeetingType} category={m.meeting_category as MeetingCategory} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    {m.rating ? <span className="text-amber-500">{'★'.repeat(m.rating)}</span> : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-[220px] truncate">{m.feedback ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === 'walkins' && (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
              <tr className="border-b">
                <th className="text-left px-4 py-3 font-medium">Client</th>
                <th className="text-left px-4 py-3 font-medium">Config</th>
                <th className="text-left px-4 py-3 font-medium">Budget</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {(walkins ?? []).length === 0 && (
                <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">No walk-ins sent via this CP yet.</td></tr>
              )}
              {(walkins ?? []).map((w: any) => (
                <tr key={w.id} className="border-b hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <a href={`/sales-marketing/walk-ins/${w.id}`} className="font-medium hover:text-primary hover:underline">
                      {[w.clients?.first_name, w.clients?.last_name].filter(Boolean).join(' ') || 'Unknown'}
                    </a>
                  </td>
                  <td className="px-4 py-3 uppercase text-xs">{w.configuration ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{w.budget ?? '—'}</td>
                  <td className="px-4 py-3">
                    <LeadStatusBadge status={w.status as LeadStatus} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                    {new Date(w.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
