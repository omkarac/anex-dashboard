import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/service';
import { UpdateStatusForm } from './UpdateStatusForm';
import type { LeadStatus } from '@/lib/schemas/sales';

export const metadata: Metadata = { title: 'Walk-in Detail — Anex Sales' };
export const dynamic = 'force-dynamic';

const CONFIG_LABELS: Record<string, string> = {
  '1bhk': '1 BHK', '2bhk': '2 BHK', '3bhk': '3 BHK',
  '2bhk_jodi': '2BHK Jodi', 'duplex': 'Duplex', '2_3bhk': '2/3 BHK',
};

const STATUS_DOT: Record<string, string> = {
  hot: '#F97316', warm: '#B45309', cold: '#1D4ED8', booked: '#15803D', lost: '#B91C1C',
};

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--sales-txt3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontSize: 14, color: value ? 'var(--sales-txt)' : 'var(--sales-txt3)' }}>
        {value || '—'}
      </div>
    </div>
  );
}

export default async function WalkInDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServiceClient();

  const { data: wi } = await supabase
    .from('walk_ins')
    .select(`
      *,
      clients ( first_name, last_name, mobile_primary, email ),
      channel_partners ( canonical_name, category, mobile_primary ),
      sales_projects ( name ),
      team_members!walk_ins_closing_sm_id_fkey ( full_name ),
      site_visits (
        id, visit_number, visit_date, visit_type, comments, proposed_revisit_date,
        team_members!site_visits_assigned_sm_id_fkey ( full_name )
      )
    `)
    .eq('id', id)
    .single();

  if (!wi) notFound();

  const client = (wi as any).clients as { first_name: string | null; last_name: string | null; mobile_primary: string; email: string | null } | null;
  const cp = (wi as any).channel_partners as { canonical_name: string; category: string; mobile_primary: string | null } | null;
  const project = (wi as any).sales_projects as { name: string } | null;
  const sm = (wi as any).team_members as { full_name: string } | null;
  const visits = (((wi as any).site_visits ?? []) as any[]).sort((a, b) => a.visit_number - b.visit_number);

  const fullName = [client?.first_name, client?.last_name].filter(Boolean).join(' ') || 'Unknown Client';
  const status = wi.status as LeadStatus;
  const dot = STATUS_DOT[status] ?? '#94A3B8';

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
      {/* Header */}
      <div style={{
        borderBottom: '1px solid var(--sales-border)',
        padding: '16px var(--content-pad)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        flexShrink: 0, gap: 12, flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Link href="/sales/walk-ins" style={{ fontSize: 12, color: 'var(--sales-txt3)', textDecoration: 'none' }}>
              ← Walk-ins
            </Link>
          </div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--sales-txt)' }}>{fullName}</h1>
          <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--sales-txt2)' }}>
            {project?.name}
            {wi.source === 'cp' && cp ? ` · CP: ${cp.canonical_name}` : ''}
            {sm ? ` · SM: ${sm.full_name}` : ''}
          </p>
        </div>
        <span className={`status-badge badge-${status}`}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: dot, display: 'inline-block', marginRight: 5 }} />
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: 'var(--content-pad)', display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 700 }}>

        {/* Client Profile */}
        <div className="sales-card" style={{ padding: 20 }}>
          <p style={{ margin: '0 0 16px', fontSize: 11, fontWeight: 700, color: 'var(--sales-txt3)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
            Client Profile
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px 24px' }}>
            <Field label="Mobile" value={client?.mobile_primary} />
            <Field label="Email" value={client?.email} />
            <Field label="Configuration" value={CONFIG_LABELS[wi.configuration ?? ''] ?? wi.configuration} />
            <Field label="Budget" value={wi.budget} />
            <Field label="Purpose" value={wi.purpose?.replace(/_/g, ' ')} />
            <Field label="Source" value={wi.source?.replace(/_/g, ' ').toUpperCase() + (cp ? ` · ${cp.canonical_name}` : '')} />
            {wi.latest_remark && (
              <div style={{ gridColumn: '1 / -1' }}>
                <Field label="Latest Remark" value={wi.latest_remark} />
              </div>
            )}
            {status === 'lost' && wi.lost_reason && (
              <Field label="Lost Reason" value={(wi.lost_reason as string).replace(/_/g, ' ')} />
            )}
          </div>
        </div>

        {/* Visit Timeline */}
        <div className="sales-card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--sales-border)' }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--sales-txt3)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
              Visit Timeline ({visits.length} visit{visits.length !== 1 ? 's' : ''})
            </p>
          </div>
          {visits.length === 0 ? (
            <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--sales-txt3)', fontSize: 14 }}>
              No site visits recorded yet.
            </div>
          ) : (
            visits.map((sv: any) => (
              <div key={sv.id} style={{ padding: '16px 20px', borderBottom: '1px solid var(--sales-border-light)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                        background: 'var(--anex-navy)', color: 'white',
                      }}>
                        Visit #{sv.visit_number}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--sales-txt2)' }}>
                        {formatDate(sv.visit_date)}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--sales-txt3)', textTransform: 'capitalize' }}>
                        {sv.visit_type?.replace(/_/g, ' ')}
                      </span>
                    </div>
                    {sv.team_members && (
                      <div style={{ fontSize: 12, color: 'var(--sales-txt3)' }}>SM: {sv.team_members.full_name}</div>
                    )}
                  </div>
                </div>
                {sv.comments && (
                  <div style={{
                    marginTop: 10, padding: '10px 14px',
                    background: 'var(--sales-bg)', borderRadius: 'var(--r)',
                    fontSize: 13, color: 'var(--sales-txt2)',
                  }}>
                    {sv.comments}
                  </div>
                )}
                {sv.proposed_revisit_date && (
                  <div style={{ marginTop: 6, fontSize: 12, color: 'var(--sales-txt3)' }}>
                    Proposed revisit: {formatDate(sv.proposed_revisit_date)}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Status Update */}
        <UpdateStatusForm
          walkInId={wi.id}
          currentStatus={status}
          currentRemark={wi.latest_remark ?? ''}
          isBooked={status === 'booked'}
        />
      </div>
    </div>
  );
}
