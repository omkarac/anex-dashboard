'use client';

import { useState } from 'react';
import { logCallAndCompleteTask, markLeadLost, type CallQueueItem } from '@/lib/actions/sales/leads';
import type { LostReason } from '@/lib/schemas/sales';
import { istTodayISO } from '@/lib/utils/formatters';

// ── Types ─────────────────────────────────────────────────────────────────────

type CallStatus = 'connected' | 'not_answering' | 'busy' | 'wrong_number' | 'not_reachable';
type CallOutcome = 'interested' | 'not_interested' | 'callback';

type CallState =
  | { phase: 'idle' }
  | { phase: 'dialling'; item: CallQueueItem }
  | { phase: 'outcome'; item: CallQueueItem; callStatus: 'connected' }
  | { phase: 'followup'; item: CallQueueItem; callStatus: 'connected'; outcome: CallOutcome }
  | { phase: 'mark_lost'; item: CallQueueItem }
  | { phase: 'done'; item: CallQueueItem; message: string };

const NOT_CONNECTED_STATUSES: { value: CallStatus; label: string }[] = [
  { value: 'not_answering', label: 'Not Answering' },
  { value: 'busy', label: 'Busy' },
  { value: 'not_reachable', label: 'Not Reachable' },
  { value: 'wrong_number', label: 'Wrong Number' },
];

const LOST_REASONS: { value: LostReason; label: string }[] = [
  { value: 'not_responding', label: 'Not Responding' },
  { value: 'budget', label: 'Budget Issue' },
  { value: 'booked_elsewhere', label: 'Booked Elsewhere' },
  { value: 'plan_dropped', label: 'Plan Dropped' },
  { value: 'not_interested', label: 'Not Interested' },
  { value: 'requirement_mismatch', label: 'Requirement Mismatch' },
  { value: 'other', label: 'Other' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function leadName(item: CallQueueItem) {
  const name = [item.lead.firstName, item.lead.lastName].filter(Boolean).join(' ');
  return name || item.lead.mobile || 'Unknown';
}

function formatMobile(m: string | null) {
  if (!m) return '—';
  return m.replace(/(\d{5})(\d{5})/, '$1 $2');
}

function taskTypeLabel(type: string) {
  const map: Record<string, string> = {
    follow_up_call: 'Follow-up Call',
    revisit_reminder: 'Revisit Reminder',
    pre_visit_confirmation: 'Pre-visit Confirm',
    post_visit_update: 'Post-visit Update',
    custom: 'Custom',
  };
  return map[type] ?? type;
}

function isOverdue(dueAt: string) {
  return new Date(dueAt) < new Date();
}

// ── Stage badge ───────────────────────────────────────────────────────────────

function StagePill({ stage }: { stage: string }) {
  const map: Record<string, string> = {
    new: 'badge-cold',
    called: 'badge-cold',
    interested: 'badge-warm',
    site_visit_scheduled: 'badge-booked',
    converted: 'badge-booked',
    lost: 'badge-lost',
  };
  const labels: Record<string, string> = {
    new: 'New',
    called: 'Called',
    interested: 'Interested',
    site_visit_scheduled: 'Visit Scheduled',
    converted: 'Converted',
    lost: 'Lost',
  };
  return (
    <span className={`status-badge ${map[stage] ?? 'badge-cold'}`}>
      {labels[stage] ?? stage}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  initialQueue: CallQueueItem[];
}

export function TeleCallingForm({ initialQueue }: Props) {
  const [queue, setQueue] = useState(initialQueue);
  const [callState, setCallState] = useState<CallState>({ phase: 'idle' });
  const [followUpDate, setFollowUpDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [lostReason, setLostReason] = useState<LostReason | ''>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function startCall(item: CallQueueItem) {
    setCallState({ phase: 'dialling', item });
    setFollowUpDate('');
    setRemarks('');
    setError('');
  }

  function reset() {
    setCallState({ phase: 'idle' });
    setFollowUpDate('');
    setRemarks('');
    setLostReason('');
    setError('');
  }

  function removeFromQueue(taskId: string) {
    setQueue(prev => prev.filter(i => i.taskId !== taskId));
  }

  async function handleNotConnected(item: CallQueueItem, callStatus: CallStatus) {
    setSubmitting(true);
    setError('');
    const res = await logCallAndCompleteTask({
      lead_id: item.lead.id,
      call_status: callStatus,
      remarks: `Call attempt — ${callStatus.replace('_', ' ')}`,
      task_id_to_complete: item.taskId,
    });
    setSubmitting(false);
    if (!res.ok) { setError(res.error); return; }

    const newCount = item.consecutiveNotConnected + 1;
    const updatedItem = { ...item, consecutiveNotConnected: newCount };

    if (newCount >= 3) {
      setCallState({ phase: 'mark_lost', item: updatedItem });
    } else {
      setCallState({ phase: 'done', item: updatedItem, message: `Logged as ${callStatus.replace(/_/g, ' ')}. ${3 - newCount} more attempt(s) before mark-lost option.` });
      removeFromQueue(item.taskId);
    }
  }

  async function handleConnectedOutcome(item: CallQueueItem, outcome: CallOutcome) {
    if (!followUpDate) { setError('Please set a follow-up date.'); return; }
    if (!remarks.trim()) { setError('Please add a remark.'); return; }

    setSubmitting(true);
    setError('');
    const outcomeMap: Record<CallOutcome, 'interested' | 'not_interested' | 'callback'> = {
      interested: 'interested',
      callback: 'callback',
      not_interested: 'not_interested',
    };
    const res = await logCallAndCompleteTask({
      lead_id: item.lead.id,
      call_status: 'connected',
      outcome: outcomeMap[outcome],
      remarks,
      next_followup_date: followUpDate,
      task_id_to_complete: item.taskId,
    });
    setSubmitting(false);
    if (!res.ok) { setError(res.error); return; }

    const msgs: Record<CallOutcome, string> = {
      interested: 'Logged as Interested. Follow-up scheduled.',
      callback: 'Callback scheduled.',
      not_interested: 'Logged as Not Interested. Follow-up scheduled.',
    };
    setCallState({ phase: 'done', item, message: msgs[outcome] });
    removeFromQueue(item.taskId);
  }

  async function handleMarkLost(item: CallQueueItem) {
    if (!lostReason) { setError('Please select a lost reason.'); return; }
    setSubmitting(true);
    setError('');
    const res = await markLeadLost({
      lead_id: item.lead.id,
      lost_reason: lostReason,
      task_id_to_complete: item.taskId,
    });
    setSubmitting(false);
    if (!res.ok) { setError(res.error); return; }
    setCallState({ phase: 'done', item, message: 'Lead marked as Lost.' });
    removeFromQueue(item.taskId);
  }

  // ── Empty state ─────────────────────────────────────────────────────────────

  if (queue.length === 0 && callState.phase === 'idle') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: 24, gap: 12, textAlign: 'center' }}>
        <div style={{ fontSize: 48 }}>✓</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--sales-txt)' }}>All Clear</div>
        <p style={{ fontSize: 14, color: 'var(--sales-txt2)', maxWidth: 300, margin: 0 }}>
          No calls scheduled for today. New tasks will appear here as follow-ups are assigned.
        </p>
      </div>
    );
  }

  // ── Done state ──────────────────────────────────────────────────────────────

  if (callState.phase === 'done') {
    return (
      <div style={{ padding: 20, maxWidth: 480, margin: '0 auto' }}>
        <div className="sales-card" style={{ padding: 24, textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>✓</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--sales-txt)', marginBottom: 6 }}>Call Logged</div>
          <p style={{ fontSize: 13, color: 'var(--sales-txt2)', margin: 0 }}>{callState.message}</p>
        </div>
        <button
          type="button"
          className="mobile-btn-option selected"
          style={{ width: '100%', minHeight: 52 }}
          onClick={reset}
        >
          {queue.length > 0 ? `Next Call (${queue.length} remaining)` : 'Back to Queue'}
        </button>
      </div>
    );
  }

  // ── Mark lost state ─────────────────────────────────────────────────────────

  if (callState.phase === 'mark_lost') {
    const item = callState.item;
    return (
      <div style={{ padding: 20, maxWidth: 480, margin: '0 auto' }}>
        <div className="sales-card" style={{ marginBottom: 16 }}>
          <div className="sales-card-header">
            <div>
              <div className="sales-card-title" style={{ color: 'var(--color-danger)' }}>Mark Lead Lost</div>
              <div className="sales-card-sub">{leadName(item)} · {formatMobile(item.lead.mobile)}</div>
            </div>
          </div>
          <div style={{ padding: 16 }}>
            <div style={{ fontSize: 13, color: 'var(--sales-txt2)', marginBottom: 14, padding: 10, background: 'var(--status-lost-bg)', borderRadius: 6, border: '1px solid var(--status-lost-border)' }}>
              <strong>3 consecutive failed attempts</strong> — you may now mark this lead as lost.
            </div>
            <div className="mobile-form-group">
              <label className="mobile-form-label">Lost Reason *</label>
              <select value={lostReason} onChange={e => setLostReason(e.target.value as LostReason)} className="mobile-input" style={{ cursor: 'pointer' }}>
                <option value="">— Select reason —</option>
                {LOST_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            {error && <p style={{ color: 'var(--color-danger)', fontSize: 13, margin: '0 0 12px' }}>{error}</p>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="mobile-btn-option"
                style={{ flex: 1 }}
                onClick={() => { setCallState({ phase: 'done', item, message: 'Skipped — lead kept in queue.' }); removeFromQueue(item.taskId); }}
              >
                Skip for Now
              </button>
              <button
                type="button"
                className="mobile-btn-option"
                style={{ flex: 1, background: 'var(--color-danger)', borderColor: 'var(--color-danger)', color: 'white' }}
                onClick={() => handleMarkLost(item)}
                disabled={submitting}
              >
                {submitting ? 'Saving…' : 'Mark Lost'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Call modal states ───────────────────────────────────────────────────────

  if (callState.phase === 'dialling' || callState.phase === 'outcome' || callState.phase === 'followup') {
    const item = callState.phase === 'dialling' ? callState.item : callState.item;

    return (
      <div style={{ padding: 20, maxWidth: 480, margin: '0 auto' }}>
        {/* Lead card */}
        <div className="sales-card" style={{ marginBottom: 16 }}>
          <div style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%',
              background: 'var(--anex-navy)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, fontWeight: 800, color: 'white', flexShrink: 0,
            }}>
              {(item.lead.firstName ?? item.lead.mobile ?? 'U').charAt(0).toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--sales-txt)', marginBottom: 2 }}>{leadName(item)}</div>
              <div style={{ fontSize: 13, color: 'var(--sales-txt2)', fontFamily: 'DM Mono, monospace' }}>{formatMobile(item.lead.mobile)}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                <StagePill stage={item.lead.stage} />
                {item.lead.projectName && (
                  <span style={{ fontSize: 11, color: 'var(--sales-txt3)', padding: '2px 6px', background: 'var(--sales-bg)', borderRadius: 4 }}>
                    {item.lead.projectName}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Phase: Connected / Not Connected */}
        {callState.phase === 'dialling' && (
          <>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--sales-txt2)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: .5 }}>
              Call Result
            </div>
            <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
              <button
                type="button"
                className="mobile-btn-option selected"
                style={{ minHeight: 64, fontSize: 16, fontWeight: 800, background: 'var(--color-success)', borderColor: 'var(--color-success)' }}
                onClick={() => setCallState({ phase: 'outcome', item, callStatus: 'connected' })}
              >
                ✓ Connected
              </button>
              {NOT_CONNECTED_STATUSES.map(s => (
                <button
                  key={s.value}
                  type="button"
                  className="mobile-btn-option"
                  style={{ minHeight: 52 }}
                  onClick={() => !submitting && handleNotConnected(item, s.value)}
                  disabled={submitting}
                >
                  {submitting ? 'Logging…' : s.label}
                </button>
              ))}
            </div>
            {item.consecutiveNotConnected > 0 && (
              <div style={{ fontSize: 12, color: 'var(--color-warning)', textAlign: 'center', marginBottom: 12 }}>
                {item.consecutiveNotConnected} consecutive failed attempt(s) — {3 - item.consecutiveNotConnected} more to unlock Mark Lost
              </div>
            )}
            {error && <p style={{ color: 'var(--color-danger)', fontSize: 13, marginBottom: 12 }}>{error}</p>}
            <button type="button" className="mobile-btn-option" style={{ width: '100%' }} onClick={reset}>Cancel</button>
          </>
        )}

        {/* Phase: Select outcome (connected) */}
        {callState.phase === 'outcome' && (
          <>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--sales-txt2)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: .5 }}>
              Outcome
            </div>
            <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
              {([
                { value: 'interested' as CallOutcome, label: 'Interested', color: 'var(--color-success)', border: 'var(--color-success)' },
                { value: 'callback' as CallOutcome, label: 'Callback', color: 'var(--anex-teal)', border: 'var(--anex-teal)' },
                { value: 'not_interested' as CallOutcome, label: 'Not Interested', color: 'var(--color-danger)', border: 'var(--color-danger)' },
              ]).map(o => (
                <button
                  key={o.value}
                  type="button"
                  className="mobile-btn-option"
                  style={{ minHeight: 56, fontSize: 15, fontWeight: 700, borderColor: o.border, color: o.color }}
                  onClick={() => setCallState({ phase: 'followup', item, callStatus: 'connected', outcome: o.value })}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <button type="button" className="mobile-btn-option" style={{ width: '100%' }} onClick={() => setCallState({ phase: 'dialling', item })}>← Back</button>
          </>
        )}

        {/* Phase: Follow-up date + remarks */}
        {callState.phase === 'followup' && (
          <>
            <div className="mobile-form-group">
              <label className="mobile-form-label">Next Follow-up Date *</label>
              <input
                type="date"
                value={followUpDate}
                onChange={e => setFollowUpDate(e.target.value)}
                min={istTodayISO()}
                className="mobile-input"
              />
            </div>
            <div className="mobile-form-group">
              <label className="mobile-form-label">Remarks *</label>
              <textarea
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                placeholder={
                  callState.outcome === 'interested'
                    ? 'What is the client interested in?'
                    : callState.outcome === 'callback'
                    ? 'Preferred callback time?'
                    : 'Why not interested?'
                }
                className="mobile-textarea"
                rows={3}
                autoFocus
              />
            </div>
            {error && <p style={{ color: 'var(--color-danger)', fontSize: 13, margin: '0 0 12px' }}>{error}</p>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="mobile-btn-option" style={{ flex: 1 }} onClick={() => setCallState({ phase: 'outcome', item, callStatus: 'connected' })}>
                ← Back
              </button>
              <button
                type="button"
                className="mobile-btn-option selected-gold"
                style={{ flex: 2, minHeight: 52, fontWeight: 800 }}
                onClick={() => handleConnectedOutcome(item, callState.outcome)}
                disabled={submitting}
              >
                {submitting ? 'Saving…' : 'Submit ✓'}
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // ── Queue list ──────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: 20, maxWidth: 600, margin: '0 auto' }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--sales-txt)' }}>
          Today's Call Queue
        </div>
        <div style={{ fontSize: 13, color: 'var(--sales-txt2)', marginTop: 2 }}>
          {queue.length} call{queue.length !== 1 ? 's' : ''} pending
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {queue.map(item => (
          <div
            key={item.taskId}
            className={`task-card ${isOverdue(item.dueAt) ? 'overdue' : 'due-today'}`}
            onClick={() => startCall(item)}
            role="button"
            tabIndex={0}
            onKeyDown={e => e.key === 'Enter' && startCall(item)}
            style={{ cursor: 'pointer' }}
          >
            {/* Lead avatar */}
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: isOverdue(item.dueAt) ? 'var(--status-lost-bg)' : 'var(--status-cold-bg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, fontWeight: 800,
              color: isOverdue(item.dueAt) ? 'var(--color-danger)' : 'var(--color-info)',
              flexShrink: 0,
            }}>
              {(item.lead.firstName ?? item.lead.mobile ?? 'U').charAt(0).toUpperCase()}
            </div>

            {/* Lead info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--sales-txt)', marginBottom: 2 }}>
                {leadName(item)}
              </div>
              <div style={{ fontSize: 12, color: 'var(--sales-txt3)', fontFamily: 'DM Mono, monospace', marginBottom: 4 }}>
                {formatMobile(item.lead.mobile)}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <StagePill stage={item.lead.stage} />
                <span style={{ fontSize: 11, color: 'var(--sales-txt3)' }}>
                  {taskTypeLabel(item.taskType)}
                </span>
                {item.consecutiveNotConnected >= 2 && (
                  <span style={{ fontSize: 11, color: 'var(--color-warning)', fontWeight: 700 }}>
                    {item.consecutiveNotConnected} failed attempts
                  </span>
                )}
              </div>
            </div>

            {/* Due indicator */}
            <div style={{ flexShrink: 0, textAlign: 'right' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: isOverdue(item.dueAt) ? 'var(--color-danger)' : 'var(--sales-txt3)' }}>
                {isOverdue(item.dueAt) ? 'Overdue' : 'Today'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--sales-txt3)', marginTop: 2 }}>
                {item.lead.projectName ?? '—'}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
