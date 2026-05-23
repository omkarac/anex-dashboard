'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createVisitSchedule } from '@/lib/actions/sales/calendar';
import type { SalesProject } from '@/lib/schemas/sales';
import { CpSearchCombobox } from '@/components/sales/CpSearchCombobox';
import { istTodayISO } from '@/lib/utils/formatters';

interface Props {
  project: SalesProject;
  currentUserId: string;
  teamMembers: { id: string; full_name: string }[];
  onClose: () => void;
}

export function ScheduleVisitSheet({ project, currentUserId, teamMembers, onClose }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    client_name: '',
    client_mobile: '',
    cp_id: '',
    closing_sm_id: currentUserId,
    tentative_date: istTodayISO(),
    tentative_time: '',
    notes: '',
  });

  function setField(key: string, value: string) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await createVisitSchedule({
        project_id: project.id,
        client_name: form.client_name,
        client_mobile: form.client_mobile || undefined,
        cp_id: form.cp_id || undefined,
        closing_sm_id: form.closing_sm_id || undefined,
        tentative_date: form.tentative_date,
        tentative_time: form.tentative_time || undefined,
        outcome_notes: form.notes || undefined,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      router.refresh();
      onClose();
    });
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      background: 'rgba(0,0,0,.4)',
    }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: '100%', maxWidth: 480, background: 'white',
        borderRadius: '16px 16px 0 0',
        padding: '0 0 env(safe-area-inset-bottom,16px)',
        maxHeight: '92dvh', overflowY: 'auto',
      }}>
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12 }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: '#DDE3ED' }} />
        </div>

        <div style={{ padding: '16px 20px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--sales-txt)' }}>
              Schedule Visit
            </h2>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--sales-txt3)', fontSize: 20 }}
            >×</button>
          </div>

          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--anex-navy)', marginBottom: 16, padding: '6px 10px', background: '#EEF2F7', borderRadius: 6 }}>
            {project.name}
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '0 20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Client name */}
          <div className="mobile-form-group">
            <label className="mobile-form-label">Client Name *</label>
            <input
              className="mobile-input"
              placeholder="e.g. Rajesh Sharma"
              value={form.client_name}
              onChange={e => setField('client_name', e.target.value)}
              required
            />
          </div>

          {/* Mobile */}
          <div className="mobile-form-group">
            <label className="mobile-form-label">Mobile</label>
            <input
              className="mobile-input"
              placeholder="10-digit mobile"
              inputMode="numeric"
              maxLength={10}
              value={form.client_mobile}
              onChange={e => setField('client_mobile', e.target.value.replace(/\D/g, ''))}
            />
          </div>

          {/* CP */}
          <div className="mobile-form-group">
            <label className="mobile-form-label">Channel Partner</label>
            <CpSearchCombobox
              value={form.cp_id || null}
              onChange={cpId => setField('cp_id', cpId)}
              projectId={project.id}
            />
          </div>

          {/* Closing SM */}
          <div className="mobile-form-group">
            <label className="mobile-form-label">Closing SM</label>
            <select
              className="mobile-input"
              value={form.closing_sm_id}
              onChange={e => setField('closing_sm_id', e.target.value)}
              style={{ height: 48, cursor: 'pointer' }}
            >
              <option value="">Not assigned</option>
              {teamMembers.map(m => (
                <option key={m.id} value={m.id}>{m.full_name}</option>
              ))}
            </select>
          </div>

          {/* Date + Time row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="mobile-form-group" style={{ marginBottom: 0 }}>
              <label className="mobile-form-label">Date *</label>
              <input
                className="mobile-input"
                type="date"
                value={form.tentative_date}
                min={istTodayISO()}
                onChange={e => setField('tentative_date', e.target.value)}
                required
              />
            </div>
            <div className="mobile-form-group" style={{ marginBottom: 0 }}>
              <label className="mobile-form-label">Time</label>
              <input
                className="mobile-input"
                type="time"
                value={form.tentative_time}
                onChange={e => setField('tentative_time', e.target.value)}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="mobile-form-group">
            <label className="mobile-form-label">Notes</label>
            <textarea
              className="mobile-textarea"
              placeholder="Any details about the visit..."
              rows={3}
              value={form.notes}
              onChange={e => setField('notes', e.target.value)}
            />
          </div>

          {error && (
            <div style={{ padding: '10px 14px', background: 'var(--status-lost-bg)', border: '1px solid var(--status-lost-border)', borderRadius: 8, color: 'var(--status-lost)', fontSize: 13 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={pending}
            style={{
              height: 52, borderRadius: 10, border: 'none', cursor: 'pointer',
              background: pending ? '#94A3B8' : 'var(--anex-navy)',
              color: 'white', fontSize: 15, fontWeight: 700,
              fontFamily: 'var(--font-sales)',
              transition: 'background .15s',
            }}
          >
            {pending ? 'Scheduling…' : 'Schedule Visit'}
          </button>
        </form>
      </div>
    </div>
  );
}
