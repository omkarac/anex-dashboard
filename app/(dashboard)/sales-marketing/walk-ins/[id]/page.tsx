import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { LeadStatusBadge } from '@/components/sales/LeadStatusBadge';
import { UpdateStatusForm } from './UpdateStatusForm';
import type { LeadStatus } from '@/lib/schemas/sales';

export const metadata: Metadata = { title: 'Walk-in Detail — Anex Sales' };

const CONFIG_LABELS: Record<string, string> = {
  '1bhk': '1 BHK', '2bhk': '2 BHK', '3bhk': '3 BHK',
  '2bhk_jodi': '2BHK Jodi', 'duplex': 'Duplex', '2_3bhk': '2/3 BHK',
};

export default async function WalkInDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: wi } = await supabase
    .from('walk_ins')
    .select(`
      *,
      clients(*),
      channel_partners(canonical_name, category, mobile_primary),
      team_members!walk_ins_closing_sm_id_fkey(full_name),
      site_visits(*, team_members!site_visits_assigned_sm_id_fkey(full_name))
    `)
    .eq('id', id)
    .single();

  if (!wi) notFound();

  const client = (wi as any).clients;
  const cp = (wi as any).channel_partners;
  const sm = (wi as any).team_members;
  const visits = ((wi as any).site_visits ?? []).sort((a: any, b: any) => a.visit_number - b.visit_number);

  const fullName = [client?.first_name, client?.last_name].filter(Boolean).join(' ') || 'Unknown Client';

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="border-b px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight">{fullName}</h1>
          <LeadStatusBadge status={wi.status as LeadStatus} />
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">
          {wi.source === 'cp' ? `CP: ${cp?.canonical_name}` : 'Direct Walk-in'}
          {sm && ` · SM: ${sm.full_name}`}
        </p>
      </div>

      <div className="flex-1 p-6 space-y-6 max-w-3xl">
        {/* Client Summary */}
        <div className="rounded-lg border bg-card p-5">
          <h2 className="text-sm font-semibold mb-4">Client Profile</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Mobile</div>
              <div className="font-mono">{client?.mobile_primary ?? '—'}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Email</div>
              <div>{client?.email ?? '—'}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Configuration</div>
              <div>{CONFIG_LABELS[wi.configuration ?? ''] ?? wi.configuration ?? '—'}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Budget</div>
              <div>{wi.budget ?? '—'}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Purpose</div>
              <div className="capitalize">{wi.purpose?.replace('_', ' ') ?? '—'}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Source</div>
              <div className="uppercase">{wi.source}{cp ? ` · ${cp.canonical_name}` : ''}</div>
            </div>
          </div>
        </div>

        {/* Visit Timeline */}
        <div className="rounded-lg border bg-card">
          <div className="px-5 py-3 border-b">
            <h2 className="text-sm font-semibold">Visit Timeline ({visits.length} visit{visits.length !== 1 ? 's' : ''})</h2>
          </div>
          <div className="divide-y">
            {visits.length === 0 && (
              <div className="px-5 py-6 text-sm text-muted-foreground">No site visits recorded yet.</div>
            )}
            {visits.map((sv: any) => (
              <div key={sv.id} className="px-5 py-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                        Visit #{sv.visit_number}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(sv.visit_date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'long', year: 'numeric' })}
                      </span>
                      <span className="text-xs text-muted-foreground capitalize">{sv.visit_type?.replace('_', ' ')}</span>
                    </div>
                    {sv.team_members && (
                      <div className="text-xs text-muted-foreground">SM: {sv.team_members.full_name}</div>
                    )}
                  </div>
                </div>
                {sv.comments && (
                  <div className="mt-2 text-sm text-muted-foreground bg-muted/30 rounded-md px-3 py-2">
                    {sv.comments}
                  </div>
                )}
                {sv.proposed_revisit_date && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    Proposed revisit: {new Date(sv.proposed_revisit_date).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Status Update */}
        <UpdateStatusForm walkInId={wi.id} currentStatus={wi.status as LeadStatus} currentRemark={wi.latest_remark ?? ''} />
      </div>
    </div>
  );
}
