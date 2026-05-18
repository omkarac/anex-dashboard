'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getTodayMeetingCounts, createEodReport } from '@/lib/actions/sales/meetings';
import type { SalesProject } from '@/lib/schemas/sales';

interface Props {
  projects: SalesProject[];
  defaultProjectId: string;
}

export function EodForm({ projects, defaultProjectId }: Props) {
  const router = useRouter();
  const [projectId, setProjectId] = useState(defaultProjectId);
  const [counts, setCounts] = useState({ obm: 0, ibm: 0, unique_obm: 0, repeat_obm: 0, unique_ibm: 0, repeat_ibm: 0 });
  const [loading, setLoading] = useState(true);
  const [callsDialled, setCallsDialled] = useState('');
  const [callsConnected, setCallsConnected] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  async function fetchCounts() {
    setLoading(true);
    if (projectId) {
      const data = await getTodayMeetingCounts(projectId);
      setCounts(data);
    }
    setLoading(false);
  }

  useEffect(() => { fetchCounts(); }, [projectId]);

  function handleProjectChange(id: string) {
    setProjectId(id);
    setSubmitted(false);
    setError('');
    window.history.replaceState(null, '', `?project=${id}`);
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError('');
    const res = await createEodReport({
      project_id: projectId,
      report_date: new Date().toISOString().split('T')[0],
      calls_dialled: parseInt(callsDialled || '0', 10),
      calls_connected: parseInt(callsConnected || '0', 10),
      notes: notes || undefined,
    });
    setSubmitting(false);
    if (!res.ok) { setError(res.error); return; }
    setSubmitted(true);
  }

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long' });
  const currentProject = projects.find(p => p.id === projectId);

  const kpis = [
    { label: 'OBMs', value: counts.obm, color: 'var(--color-warning)' },
    { label: 'IBMs', value: counts.ibm, color: 'var(--color-info)' },
    { label: 'Unique OBMs', value: counts.unique_obm, color: 'var(--anex-navy)' },
    { label: 'Repeat OBMs', value: counts.repeat_obm, color: 'var(--sales-txt3)' },
    { label: 'Unique IBMs', value: counts.unique_ibm, color: 'var(--anex-navy)' },
    { label: 'Repeat IBMs', value: counts.repeat_ibm, color: 'var(--sales-txt3)' },
  ];

  if (submitted) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 'var(--content-pad)' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>✓</div>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--sales-txt)' }}>EOD Report Submitted</h2>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--sales-txt3)' }}>
          Your end-of-day report has been saved for {currentProject?.name}.
        </p>
        <button
          onClick={() => router.push('/sales/dashboard')}
          style={{
            height: 44, padding: '0 24px',
            background: 'var(--anex-navy)', color: 'white',
            border: 'none', borderRadius: 'var(--r)',
            fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
      {/* Header */}
      <div style={{
        borderBottom: '1px solid var(--sales-border)', padding: '16px var(--content-pad)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--sales-txt)' }}>EOD Report</h1>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--sales-txt3)', marginTop: 2 }}>{today}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {projects.length > 1 && (
            <select
              value={projectId}
              onChange={e => handleProjectChange(e.target.value)}
              style={{
                height: 36, fontSize: 13, padding: '0 10px', borderRadius: 'var(--r)',
                border: '1.5px solid var(--sales-border)', background: 'white',
                color: 'var(--sales-txt)', fontFamily: 'inherit', cursor: 'pointer',
              }}
            >
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
          <button
            onClick={fetchCounts}
            disabled={loading}
            style={{
              height: 36, padding: '0 14px',
              border: '1.5px solid var(--sales-border)', borderRadius: 'var(--r)',
              background: 'white', fontSize: 13, fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              color: 'var(--sales-txt2)', fontFamily: 'inherit',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Loading…' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: 'var(--content-pad)', maxWidth: 640 }}>
        {/* Auto-computed KPIs */}
        <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--sales-txt3)', textTransform: 'uppercase', letterSpacing: '.5px', margin: '0 0 12px' }}>
          Today&apos;s Activity (auto-computed)
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 24 }}>
          {kpis.map(k => (
            <div key={k.label} className="kpi-tile" style={{ borderTopColor: k.color }}>
              <div className="kpi-value" style={{ fontSize: 24, color: 'var(--sales-txt)' }}>{loading ? '…' : k.value}</div>
              <div className="kpi-label">{k.label}</div>
            </div>
          ))}
        </div>

        {/* Manual entry */}
        <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--sales-txt3)', textTransform: 'uppercase', letterSpacing: '.5px', margin: '0 0 12px' }}>
          Manual Entry
        </p>
        <div className="sales-card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--sales-txt)' }}>Calls Dialled</span>
              <input
                type="number"
                min="0"
                value={callsDialled}
                onChange={e => setCallsDialled(e.target.value)}
                placeholder="0"
                inputMode="numeric"
                className="mobile-input"
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--sales-txt)' }}>Calls Connected</span>
              <input
                type="number"
                min="0"
                value={callsConnected}
                onChange={e => setCallsConnected(e.target.value)}
                placeholder="0"
                inputMode="numeric"
                className="mobile-input"
              />
            </label>
          </div>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--sales-txt)' }}>Notes</span>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any observations, highlights, or blockers from today..."
              rows={3}
              style={{
                width: '100%', padding: '10px 12px',
                border: '1.5px solid var(--sales-border)', borderRadius: 'var(--r)',
                fontSize: 14, fontFamily: 'inherit', color: 'var(--sales-txt)',
                resize: 'vertical', boxSizing: 'border-box',
              }}
            />
          </label>
        </div>

        {error && (
          <p style={{ fontSize: 13, color: 'var(--color-danger)', marginBottom: 12 }}>{error}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting || !projectId}
          style={{
            width: '100%', height: 52,
            background: submitting || !projectId ? 'var(--sales-txt3)' : 'var(--anex-navy)',
            color: 'white', border: 'none', borderRadius: 'var(--r)',
            fontSize: 15, fontWeight: 700, cursor: submitting || !projectId ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {submitting ? 'Submitting…' : 'Submit EOD Report'}
        </button>
      </div>
    </div>
  );
}
