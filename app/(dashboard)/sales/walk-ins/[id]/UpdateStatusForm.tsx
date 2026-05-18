'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateWalkInStatus } from '@/lib/actions/sales/walk-ins';
import type { LeadStatus, LostReason } from '@/lib/schemas/sales';

const LOST_REASONS: { value: LostReason; label: string }[] = [
  { value: 'not_responding', label: 'Not Responding' },
  { value: 'budget', label: 'Budget' },
  { value: 'booked_elsewhere', label: 'Booked Elsewhere' },
  { value: 'plan_dropped', label: 'Plan Dropped' },
  { value: 'didnt_like_project', label: "Didn't Like Project" },
  { value: 'layout_issue', label: 'Layout Issue' },
  { value: 'requirement_mismatch', label: 'Requirement Mismatch' },
  { value: 'not_interested', label: 'Not Interested' },
  { value: 'general_enquiry', label: 'General Enquiry' },
  { value: 'location_issue', label: 'Location Issue' },
  { value: 'floor_issue', label: 'Floor Issue' },
  { value: 'possession_timeline', label: 'Possession Timeline' },
  { value: 'vaastu_issue', label: 'Vaastu Issue' },
  { value: 'view_issue', label: 'View Issue' },
  { value: 'other', label: 'Other' },
];

const STATUS_CONFIG: Record<LeadStatus, { label: string; color: string; bg: string; border: string }> = {
  hot:    { label: 'Hot',    color: '#F97316', bg: '#FFF7ED', border: '#FDBA74' },
  warm:   { label: 'Warm',   color: '#B45309', bg: '#FFFBEB', border: '#FCD34D' },
  cold:   { label: 'Cold',   color: '#1D4ED8', bg: '#EFF6FF', border: '#93C5FD' },
  booked: { label: 'Booked', color: '#15803D', bg: '#F0FDF4', border: '#86EFAC' },
  lost:   { label: 'Lost',   color: '#B91C1C', bg: '#FEF2F2', border: '#FCA5A5' },
};

const ALL_STATUSES: LeadStatus[] = ['hot', 'warm', 'cold', 'booked', 'lost'];

interface Props {
  walkInId: string;
  currentStatus: LeadStatus;
  currentRemark: string;
  isBooked: boolean;
}

export function UpdateStatusForm({ walkInId, currentStatus, currentRemark, isBooked }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<LeadStatus>(currentStatus);
  const [remark, setRemark] = useState(currentRemark);
  const [lostReason, setLostReason] = useState<LostReason | ''>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleUpdate() {
    if (!remark.trim()) { setError('Please add a remark.'); return; }
    if (status === 'lost' && !lostReason) { setError('Please select a lost reason.'); return; }
    setSubmitting(true);
    setError('');
    const res = await updateWalkInStatus({
      walk_in_id: walkInId,
      status,
      remark,
      lost_reason: status === 'lost' ? (lostReason as LostReason) : undefined,
    });
    setSubmitting(false);
    if (!res.ok) { setError(res.error); return; }
    router.refresh();
  }

  if (isBooked) {
    return (
      <div className="sales-card" style={{ padding: 20 }}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--sales-txt3)', textAlign: 'center' }}>
          Status is <strong>Booked</strong> — no further status changes allowed.
        </p>
      </div>
    );
  }

  return (
    <div className="sales-card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--sales-txt3)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
        Update Status &amp; Remark
      </p>

      {/* Status buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--sales-txt)' }}>New Status</span>
        <div className="mobile-btn-group" style={{ flexWrap: 'wrap', gap: 8 }}>
          {ALL_STATUSES.filter(s => s !== 'booked').map(s => {
            const cfg = STATUS_CONFIG[s];
            const active = status === s;
            return (
              <button
                key={s}
                onClick={() => setStatus(s)}
                style={{
                  flex: '1 1 80px', minWidth: 80, height: 44,
                  border: `1.5px solid ${active ? cfg.border : 'var(--sales-border)'}`,
                  borderRadius: 'var(--r)',
                  background: active ? cfg.bg : 'white',
                  color: active ? cfg.color : 'var(--sales-txt2)',
                  fontSize: 13, fontWeight: active ? 700 : 500,
                  cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'all .15s',
                }}
              >
                {cfg.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Lost reason */}
      {status === 'lost' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--sales-txt)' }}>
            Lost Reason <span style={{ color: 'var(--color-danger)' }}>*</span>
          </label>
          <select
            value={lostReason}
            onChange={e => setLostReason(e.target.value as LostReason)}
            style={{
              height: 44, fontSize: 14, padding: '0 12px',
              border: '1.5px solid var(--sales-border)', borderRadius: 'var(--r)',
              background: 'white', color: 'var(--sales-txt)', fontFamily: 'inherit', cursor: 'pointer',
            }}
          >
            <option value="">Select reason…</option>
            {LOST_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
      )}

      {/* Remark */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--sales-txt)' }}>
          Remark <span style={{ color: 'var(--color-danger)' }}>*</span>
        </label>
        <textarea
          value={remark}
          onChange={e => setRemark(e.target.value)}
          placeholder="Add a note about this status update..."
          rows={3}
          style={{
            width: '100%', padding: '10px 12px', boxSizing: 'border-box',
            border: '1.5px solid var(--sales-border)', borderRadius: 'var(--r)',
            fontSize: 14, fontFamily: 'inherit', color: 'var(--sales-txt)', resize: 'vertical',
          }}
        />
      </div>

      {error && <p style={{ margin: 0, fontSize: 13, color: 'var(--color-danger)' }}>{error}</p>}

      <button
        onClick={handleUpdate}
        disabled={submitting}
        style={{
          height: 48, width: '100%',
          background: submitting ? 'var(--sales-txt3)' : 'var(--anex-navy)',
          color: 'white', border: 'none', borderRadius: 'var(--r)',
          fontSize: 14, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
        }}
      >
        {submitting ? 'Updating…' : 'Update Status'}
      </button>
    </div>
  );
}
