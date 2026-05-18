'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateVisitScheduleStatus, type VisitScheduleRow } from '@/lib/actions/sales/calendar';
import type { SalesProject } from '@/lib/schemas/sales';
import { ScheduleVisitSheet } from './ScheduleVisitSheet';

interface DateSection {
  date: string;
  label: string;
  isToday: boolean;
  isFuture: boolean;
  visits: VisitScheduleRow[];
}

interface Props {
  project: SalesProject;
  currentUserId: string;
  teamMembers: { id: string; full_name: string }[];
  dateSections: DateSection[];
}

const STATUS_STYLE: Record<string, { bg: string; color: string; border: string; label: string }> = {
  tentative:     { bg: 'var(--status-warm-bg)',   color: 'var(--status-warm)',  border: 'var(--status-warm-border)',  label: 'Tentative' },
  confirmed:     { bg: 'var(--status-cold-bg)',   color: 'var(--status-cold)',  border: 'var(--status-cold-border)',  label: 'Confirmed' },
  reminder_sent: { bg: '#EDE9FE',                 color: '#7C3AED',             border: '#DDD6FE',                    label: 'Reminder Sent' },
  visited:       { bg: 'var(--status-booked-bg)', color: 'var(--status-booked)',border: 'var(--status-booked-border)',label: 'Visited' },
  no_show:       { bg: 'var(--status-lost-bg)',   color: 'var(--status-lost)',  border: 'var(--status-lost-border)',  label: 'No-show' },
  rescheduled:   { bg: '#F1F5F9',                 color: '#64748B',             border: '#CBD5E1',                    label: 'Rescheduled' },
  cancelled:     { bg: '#F1F5F9',                 color: '#94A3B8',             border: '#E2E8F0',                    label: 'Cancelled' },
};

function VisitCard({ visit }: { visit: VisitScheduleRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  const statusStyle = STATUS_STYLE[visit.status] ?? STATUS_STYLE.tentative;
  const canConfirm = visit.status === 'tentative' || visit.status === 'reminder_sent';
  const canVisited = visit.status === 'confirmed' || visit.status === 'tentative' || visit.status === 'reminder_sent';
  const canNoShow = canVisited;
  const canCancel = !['visited', 'cancelled', 'no_show'].includes(visit.status);

  function action(status: string) {
    setActionError(null);
    startTransition(async () => {
      const result = await updateVisitScheduleStatus({ visit_id: visit.id, status: status as never });
      if (!result.ok) { setActionError(result.error); return; }
      router.refresh();
    });
  }

  return (
    <div style={{
      background: 'white', borderRadius: 10, border: '1px solid var(--sales-border)',
      padding: '14px 16px', boxShadow: 'var(--shadow-sm)',
      opacity: pending ? 0.6 : 1, transition: 'opacity .15s',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        {/* Left: client + cp info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--sales-txt)' }}>
              {visit.client_name ?? 'Unknown Client'}
            </span>
            {visit.tentative_time && (
              <span style={{ fontSize: 12, color: 'var(--sales-txt3)', fontWeight: 500 }}>
                {visit.tentative_time.slice(0, 5)}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: 12, color: 'var(--sales-txt2)' }}>
            {visit.client_mobile && (
              <span>📱 {visit.client_mobile}</span>
            )}
            {visit.cp_name && (
              <span>🏢 {visit.cp_name}</span>
            )}
            {visit.closing_sm_name && (
              <span>👤 {visit.closing_sm_name}</span>
            )}
          </div>

          {visit.outcome_notes && (
            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--sales-txt3)', fontStyle: 'italic' }}>
              {visit.outcome_notes}
            </div>
          )}
        </div>

        {/* Status badge */}
        <div style={{
          padding: '3px 10px', borderRadius: 20, border: `1px solid ${statusStyle.border}`,
          background: statusStyle.bg, color: statusStyle.color,
          fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0,
        }}>
          {statusStyle.label}
        </div>
      </div>

      {/* Action buttons */}
      {(canConfirm || canVisited || canNoShow || canCancel) && (
        <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
          {canConfirm && (
            <ActionBtn onClick={() => action('confirmed')} color="var(--status-cold)" disabled={pending}>
              Confirm
            </ActionBtn>
          )}
          {canVisited && (
            <ActionBtn onClick={() => action('visited')} color="var(--status-booked)" disabled={pending}>
              Mark Visited
            </ActionBtn>
          )}
          {canNoShow && (
            <ActionBtn onClick={() => action('no_show')} color="var(--status-warm)" disabled={pending}>
              No-show
            </ActionBtn>
          )}
          {canCancel && (
            <ActionBtn onClick={() => action('cancelled')} color="var(--status-lost)" disabled={pending}>
              Cancel
            </ActionBtn>
          )}
        </div>
      )}

      {actionError && (
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--status-lost)' }}>{actionError}</div>
      )}
    </div>
  );
}

function ActionBtn({
  children, onClick, color, disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  color: string;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        height: 30, padding: '0 12px', borderRadius: 6, cursor: 'pointer',
        border: `1px solid ${color}`, background: 'transparent',
        color, fontSize: 11, fontWeight: 700,
        fontFamily: 'var(--font-sales)',
        opacity: disabled ? 0.5 : 1,
        transition: 'background .1s',
      }}
      onMouseEnter={e => { if (!disabled) (e.target as HTMLElement).style.background = color + '18'; }}
      onMouseLeave={e => { (e.target as HTMLElement).style.background = 'transparent'; }}
    >
      {children}
    </button>
  );
}

export function CalendarClient({ project, currentUserId, teamMembers, dateSections }: Props) {
  const [showSheet, setShowSheet] = useState(false);

  return (
    <>
      {/* Section header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--sales-txt)' }}>
            Upcoming Visits
          </h2>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--sales-txt3)' }}>
            Next 60 days — excludes cancelled &amp; rescheduled
          </p>
        </div>
        <button
          onClick={() => setShowSheet(true)}
          style={{
            height: 40, padding: '0 18px', borderRadius: 8, border: 'none',
            background: 'var(--anex-navy)', color: 'white',
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
            fontFamily: 'var(--font-sales)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <span style={{ fontSize: 16 }}>+</span> Schedule Visit
        </button>
      </div>

      {/* Visit list grouped by date */}
      {dateSections.length === 0 ? (
        <div style={{
          background: 'white', borderRadius: 12, border: '1px solid var(--sales-border)',
          padding: 40, textAlign: 'center', color: 'var(--sales-txt3)', fontSize: 14,
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📅</div>
          No visits scheduled for the next 60 days.
          <br />
          <span style={{ fontSize: 12 }}>Click &quot;Schedule Visit&quot; to add one.</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {dateSections.map(section => (
            <div key={section.date}>
              {/* Date header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10,
              }}>
                <span style={{
                  fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.4px',
                  color: section.isToday ? 'var(--anex-navy)' : 'var(--sales-txt2)',
                  padding: section.isToday ? '3px 10px' : '3px 0',
                  background: section.isToday ? '#EEF2F7' : 'transparent',
                  borderRadius: section.isToday ? 20 : 0,
                }}>
                  {section.label}
                </span>
                <div style={{ flex: 1, height: 1, background: 'var(--sales-border-light)' }} />
                <span style={{ fontSize: 11, color: 'var(--sales-txt3)' }}>
                  {section.visits.length} visit{section.visits.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Visit cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {section.visits.map(v => <VisitCard key={v.id} visit={v} />)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Schedule visit bottom sheet */}
      {showSheet && (
        <ScheduleVisitSheet
          project={project}
          currentUserId={currentUserId}
          teamMembers={teamMembers}
          onClose={() => setShowSheet(false)}
        />
      )}
    </>
  );
}
