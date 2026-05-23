'use client';

import { useReducer, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { CpSearchCombobox } from '@/components/sales/CpSearchCombobox';
import { processWalkInIntake } from '@/lib/actions/sales/walk-ins';
import { updateWalkInStatus } from '@/lib/actions/sales/walk-ins';
import { lookupClientByMobile } from '@/lib/actions/sales/clients';
import type { Config, Purpose, LostReason } from '@/lib/schemas/sales';
import type { TeamMemberSelect } from '@/lib/queries/team';
import { istTodayISO } from '@/lib/utils/formatters';

// ── Types ─────────────────────────────────────────────────────────────────────

type HwclStatus = 'hot' | 'warm' | 'cold' | 'lost';

type WizardState = {
  step: number;
  mobile: string;
  existingClient: { id: string; firstName: string | null; lastName: string | null; visitNumber: number } | null;
  firstName: string;
  lastName: string;
  email: string;
  accompaniedBy: 'alone' | 'family' | 'friends' | '';
  source: 'cp' | 'direct' | '';
  cpId: string | null;
  configuration: Config | '';
  budget: string;
  purpose: Purpose | '';
  possessionTimeframe: string;
  ageBracket: string;
  occupation: string;
  employmentType: string;
  visitType: 'site_visit' | 'home_visit' | 'video_call' | 'office_visit';
  hwcl: HwclStatus | '';
  lostReason: LostReason | '';
  nextFollowupDate: string;
  greRemarks: string;
  assignedSmId: string;
};

type WizardAction =
  | { type: 'NEXT' }
  | { type: 'PREV' }
  | { type: 'SET'; key: keyof WizardState; value: string | null }
  | { type: 'CLIENT_FOUND'; client: WizardState['existingClient'] }
  | { type: 'NO_CLIENT' };

function initState(): WizardState {
  return {
    step: 1,
    mobile: '', existingClient: null,
    firstName: '', lastName: '', email: '', accompaniedBy: '',
    source: '', cpId: null,
    configuration: '', budget: '', purpose: '', possessionTimeframe: '',
    ageBracket: '', occupation: '', employmentType: '',
    visitType: 'site_visit',
    hwcl: '', lostReason: '', nextFollowupDate: '', greRemarks: '',
    assignedSmId: '',
  };
}

function reducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'NEXT': {
      if (state.step === 1) {
        // Skip step 2 (client details) for returning visitors
        return { ...state, step: state.existingClient ? 3 : 2 };
      }
      return { ...state, step: Math.min(state.step + 1, 6) };
    }
    case 'PREV': {
      if (state.step === 3 && state.existingClient) {
        return { ...state, step: 1 };
      }
      return { ...state, step: Math.max(state.step - 1, 1) };
    }
    case 'SET':
      return { ...state, [action.key]: action.value ?? '' };
    case 'CLIENT_FOUND':
      return {
        ...state,
        existingClient: action.client,
        firstName: action.client?.firstName ?? '',
        lastName: action.client?.lastName ?? '',
      };
    case 'NO_CLIENT':
      return { ...state, existingClient: null };
    default:
      return state;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function BtnGroup<T extends string>({
  options, value, onChange, cols = 2, tall = false,
}: {
  options: { value: T; label: string; sub?: string }[];
  value: T | '';
  onChange: (v: T) => void;
  cols?: number;
  tall?: boolean;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 8 }}>
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`mobile-btn-option${value === o.value ? ' selected' : ''}`}
          style={{ minHeight: tall ? 56 : 44, flexDirection: 'column', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1.3 }}
        >
          {o.label}
          {o.sub && <span style={{ fontSize: 11, fontWeight: 400, opacity: .75 }}>{o.sub}</span>}
        </button>
      ))}
    </div>
  );
}

const HWCL_OPTIONS = [
  { value: 'hot' as HwclStatus, label: 'Hot', sub: 'Very interested' },
  { value: 'warm' as HwclStatus, label: 'Warm', sub: 'Interested' },
  { value: 'cold' as HwclStatus, label: 'Cold', sub: 'Browsing' },
  { value: 'lost' as HwclStatus, label: 'Lost', sub: 'Not proceeding' },
];

const CONFIG_OPTIONS = [
  { value: '1bhk' as Config, label: '1 BHK' },
  { value: '2bhk' as Config, label: '2 BHK' },
  { value: '3bhk' as Config, label: '3 BHK' },
  { value: '2bhk_jodi' as Config, label: '2BHK Jodi' },
  { value: 'duplex' as Config, label: 'Duplex' },
  { value: 'commercial' as Config, label: 'Commercial' },
];

const PURPOSE_OPTIONS = [
  { value: 'self_use' as Purpose, label: 'Self Use' },
  { value: 'investment' as Purpose, label: 'Investment' },
  { value: 'both' as Purpose, label: 'Both' },
];

const VISIT_TYPE_OPTIONS = [
  { value: 'site_visit' as const, label: 'Site Visit' },
  { value: 'home_visit' as const, label: 'Home Visit' },
  { value: 'video_call' as const, label: 'Video Call' },
  { value: 'office_visit' as const, label: 'Office Visit' },
];

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

// ── Wizard component ──────────────────────────────────────────────────────────

interface Props {
  projectId: string;
  smList: TeamMemberSelect[];
}

export function WalkInWizard({ projectId, smList }: Props) {
  const router = useRouter();
  const [state, dispatch] = useReducer(reducer, undefined, initState);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ walkInId: string; visitNumber: number; isNewClient: boolean; scenario: number } | null>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus mobile input on mount
  useEffect(() => { mobileInputRef.current?.focus(); }, []);

  function set(key: keyof WizardState, value: string | null) {
    dispatch({ type: 'SET', key, value });
  }

  async function handleMobileContinue() {
    const digits = state.mobile.replace(/\D/g, '');
    if (digits.length < 10) { setError('Enter a valid 10-digit mobile number.'); return; }
    setChecking(true);
    setError('');
    const existing = await lookupClientByMobile(state.mobile);
    if (existing) {
      dispatch({ type: 'CLIENT_FOUND', client: {
        id: existing.id,
        firstName: existing.first_name ?? null,
        lastName: existing.last_name ?? null,
        visitNumber: 1, // approximate — server will compute exact
      }});
    } else {
      dispatch({ type: 'NO_CLIENT' });
    }
    setChecking(false);
    dispatch({ type: 'NEXT' });
  }

  async function handleSubmit() {
    if (state.source === 'cp' && !state.cpId) { setError('Please select a Channel Partner.'); return; }
    if (state.hwcl === 'lost' && !state.lostReason) { setError('Please select a lost reason.'); return; }
    if ((state.hwcl === 'warm' || state.hwcl === 'cold') && !state.nextFollowupDate) {
      setError('Please set a follow-up date for warm/cold leads.'); return;
    }

    setSubmitting(true);
    setError('');

    const intakeRes = await processWalkInIntake({
      project_id: projectId,
      mobile: state.mobile,
      first_name: state.firstName || undefined,
      last_name: state.lastName || undefined,
      email: state.email || undefined,
      accompanied_by: (state.accompaniedBy || undefined) as 'alone' | 'family' | 'friends' | undefined,
      source: state.source as 'cp' | 'direct',
      cp_id: state.cpId ?? undefined,
      configuration: (state.configuration || undefined) as Config | undefined,
      budget: state.budget || undefined,
      purpose: (state.purpose || undefined) as Purpose | undefined,
      possession_timeframe: state.possessionTimeframe || undefined,
      age_bracket: (state.ageBracket || undefined) as 'below_25' | '25_30' | '31_40' | '41_50' | '51_60' | 'above_60' | undefined,
      occupation: state.occupation || undefined,
      employment_type: (state.employmentType || undefined) as 'salaried' | 'self_employed' | 'business_owner' | 'retired' | 'student' | 'other' | undefined,
      visit_type: state.visitType,
      assigned_sm_id: state.assignedSmId || undefined,
      gre_remarks: state.greRemarks || undefined,
    });

    if (!intakeRes.ok) { setSubmitting(false); setError(intakeRes.error); return; }

    // Set initial HWCL status if not cold (cold is the default)
    if (state.hwcl && state.hwcl !== 'cold') {
      await updateWalkInStatus({
        walk_in_id: intakeRes.data.walkInId,
        status: state.hwcl,
        remark: 'Initial assessment at walk-in',
        lost_reason: state.hwcl === 'lost' ? (state.lostReason as LostReason) : undefined,
      });
    }

    setSubmitting(false);
    setSuccess({
      walkInId: intakeRes.data.walkInId,
      visitNumber: intakeRes.data.visitNumber,
      isNewClient: intakeRes.data.isNewClient,
      scenario: intakeRes.data.scenario,
    });
  }

  // ── Success screen ────────────────────────────────────────────────────────

  if (success) {
    const msgs: Record<number, string> = {
      2: 'New client registered and site visit #1 logged.',
      3: 'Site visit #1 logged for existing client.',
      4: `Revisit logged — visit #${success.visitNumber} for this client.`,
      5: 'Fresh engagement started — new walk-in and visit #1 logged.',
    };
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: 24 }}>
        <div className="sales-card" style={{ maxWidth: 400, width: '100%', padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✓</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--sales-txt)', marginBottom: 8 }}>Walk-in Logged</div>
          <p style={{ fontSize: 13, color: 'var(--sales-txt2)', marginBottom: 16 }}>
            {msgs[success.scenario] ?? 'Walk-in processed successfully.'}
          </p>
          {success.visitNumber > 1 && (
            <div className="status-badge badge-cold" style={{ display: 'inline-flex', marginBottom: 16 }}>
              Visit #{success.visitNumber} — Revisit
            </div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="mobile-btn-option"
              style={{ flex: 1 }}
              onClick={() => router.push(`/sales/walk-ins?project=${projectId}`)}
            >
              View MIS
            </button>
            <button
              type="button"
              className="mobile-btn-option selected"
              style={{ flex: 1 }}
              onClick={() => router.push(`/sales-marketing/walk-ins/${success.walkInId}`)}
            >
              View Record
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isReturning = !!state.existingClient;
  const totalSteps = 6;
  const displayStep = state.step > 1 && isReturning ? state.step - 1 : state.step;
  const displayTotal = isReturning ? totalSteps - 1 : totalSteps;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Step header */}
      <div style={{ borderBottom: '1px solid var(--sales-border)', padding: '16px 20px', flexShrink: 0, background: 'white' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--sales-txt)' }}>New Walk-in</div>
          <div style={{ fontSize: 12, color: 'var(--sales-txt3)', fontWeight: 600 }}>
            Step {displayStep} / {displayTotal}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {Array.from({ length: displayTotal }, (_, i) => (
            <div
              key={i}
              style={{
                flex: 1, height: 4, borderRadius: 4,
                background: i < displayStep - 1 ? 'var(--anex-navy)' : i === displayStep - 1 ? 'var(--anex-teal)' : 'var(--sales-border)',
                transition: 'background .2s',
              }}
            />
          ))}
        </div>
      </div>

      {/* Returning visitor banner */}
      {isReturning && state.step > 1 && (
        <div className="alert-strip" style={{ margin: '12px 20px 0', borderRadius: 8, flexShrink: 0 }}>
          <span>Returning visitor — <b>{[state.existingClient!.firstName, state.existingClient!.lastName].filter(Boolean).join(' ') || state.mobile}</b></span>
        </div>
      )}

      {/* Step content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 100px' }}>
        {/* Step 1: Mobile */}
        {state.step === 1 && (
          <div className="mobile-form-group">
            <label className="mobile-form-label">Mobile Number *</label>
            <input
              ref={mobileInputRef}
              type="tel"
              inputMode="numeric"
              value={state.mobile}
              onChange={e => set('mobile', e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleMobileContinue()}
              placeholder="10-digit mobile number"
              className="mobile-input"
              style={{ fontSize: 18, height: 56, letterSpacing: 1 }}
              autoFocus
            />
            {error && <p style={{ color: 'var(--color-danger)', fontSize: 13, margin: 0 }}>{error}</p>}
          </div>
        )}

        {/* Step 2: Client details (new clients only) */}
        {state.step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* grid-2 stacks to 1-col on mobile */}
            <div className="grid-2">
              <div className="mobile-form-group" style={{ marginBottom: 0 }}>
                <label className="mobile-form-label">First Name</label>
                <input type="text" value={state.firstName} onChange={e => set('firstName', e.target.value)} className="mobile-input" />
              </div>
              <div className="mobile-form-group" style={{ marginBottom: 0 }}>
                <label className="mobile-form-label">Last Name</label>
                <input type="text" value={state.lastName} onChange={e => set('lastName', e.target.value)} className="mobile-input" />
              </div>
            </div>
            <div className="mobile-form-group" style={{ marginBottom: 0 }}>
              <label className="mobile-form-label">Email</label>
              <input type="email" value={state.email} onChange={e => set('email', e.target.value)} className="mobile-input" placeholder="optional" />
            </div>
            <div className="mobile-form-group" style={{ marginBottom: 0 }}>
              <label className="mobile-form-label">Accompanied By</label>
              <BtnGroup
                options={[
                  { value: 'alone' as const, label: 'Alone' },
                  { value: 'family' as const, label: 'Family' },
                  { value: 'friends' as const, label: 'Friends' },
                ]}
                value={state.accompaniedBy}
                onChange={v => set('accompaniedBy', v)}
                cols={3}
              />
            </div>
          </div>
        )}

        {/* Step 3: Source */}
        {state.step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="mobile-form-group" style={{ marginBottom: 0 }}>
              <label className="mobile-form-label">Lead Source *</label>
              <BtnGroup
                options={[
                  { value: 'cp' as const, label: 'Channel Partner', sub: 'Referred by broker' },
                  { value: 'direct' as const, label: 'Direct', sub: 'Self walk-in' },
                ]}
                value={state.source}
                onChange={v => set('source', v)}
                cols={2}
                tall
              />
            </div>
            {state.source === 'cp' && (
              <div className="mobile-form-group" style={{ marginBottom: 0 }}>
                <label className="mobile-form-label">Channel Partner *</label>
                <CpSearchCombobox
                  value={state.cpId}
                  onChange={id => set('cpId', id)}
                  projectId={projectId}
                />
              </div>
            )}
            {error && <p style={{ color: 'var(--color-danger)', fontSize: 13, margin: 0 }}>{error}</p>}
          </div>
        )}

        {/* Step 4: Requirements */}
        {state.step === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="mobile-form-group" style={{ marginBottom: 0 }}>
              <label className="mobile-form-label">Configuration</label>
              <BtnGroup options={CONFIG_OPTIONS} value={state.configuration} onChange={v => set('configuration', v)} cols={3} />
            </div>
            <div className="mobile-form-group" style={{ marginBottom: 0 }}>
              <label className="mobile-form-label">Budget Range</label>
              <input type="text" value={state.budget} onChange={e => set('budget', e.target.value)} className="mobile-input" placeholder="e.g. 1.8 – 2.2 Cr" />
            </div>
            <div className="mobile-form-group" style={{ marginBottom: 0 }}>
              <label className="mobile-form-label">Purpose</label>
              <BtnGroup options={PURPOSE_OPTIONS} value={state.purpose} onChange={v => set('purpose', v)} cols={3} />
            </div>
          </div>
        )}

        {/* Step 5: Demographics (optional) */}
        {state.step === 5 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ fontSize: 12, color: 'var(--sales-txt3)', margin: 0 }}>Optional — helps with analytics. You can skip this step.</p>
            <div className="mobile-form-group" style={{ marginBottom: 0 }}>
              <label className="mobile-form-label">Age Bracket</label>
              <BtnGroup
                options={[
                  { value: 'below_25', label: '<25' },
                  { value: '25_30', label: '25–30' },
                  { value: '31_40', label: '31–40' },
                  { value: '41_50', label: '41–50' },
                  { value: '51_60', label: '51–60' },
                  { value: 'above_60', label: '60+' },
                ] as { value: string; label: string }[]}
                value={state.ageBracket}
                onChange={v => set('ageBracket', v)}
                cols={3}
              />
            </div>
            <div className="mobile-form-group" style={{ marginBottom: 0 }}>
              <label className="mobile-form-label">Occupation</label>
              <input type="text" value={state.occupation} onChange={e => set('occupation', e.target.value)} className="mobile-input" placeholder="e.g. Doctor, IT professional" />
            </div>
            <div className="mobile-form-group" style={{ marginBottom: 0 }}>
              <label className="mobile-form-label">Employment Type</label>
              <select value={state.employmentType} onChange={e => set('employmentType', e.target.value)} className="mobile-input" style={{ cursor: 'pointer' }}>
                <option value="">— Select —</option>
                <option value="salaried">Salaried</option>
                <option value="self_employed">Self Employed</option>
                <option value="business_owner">Business Owner</option>
                <option value="retired">Retired</option>
                <option value="student">Student</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
        )}

        {/* Step 6: Visit + HWCL */}
        {state.step === 6 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="mobile-form-group" style={{ marginBottom: 0 }}>
              <label className="mobile-form-label">Visit Type</label>
              <BtnGroup options={VISIT_TYPE_OPTIONS} value={state.visitType} onChange={v => set('visitType', v)} cols={2} />
            </div>

            <div className="mobile-form-group" style={{ marginBottom: 0 }}>
              <label className="mobile-form-label">Lead Status (HWCL) *</label>
              <BtnGroup options={HWCL_OPTIONS} value={state.hwcl} onChange={v => set('hwcl', v)} cols={2} tall />
            </div>

            {/* Lost reason — only when HWCL = Lost */}
            {state.hwcl === 'lost' && (
              <div className="mobile-form-group" style={{ marginBottom: 0 }}>
                <label className="mobile-form-label">Lost Reason *</label>
                <select value={state.lostReason} onChange={e => set('lostReason', e.target.value)} className="mobile-input" style={{ cursor: 'pointer' }}>
                  <option value="">— Select reason —</option>
                  {LOST_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
            )}

            {/* Follow-up date — required for warm/cold */}
            {(state.hwcl === 'warm' || state.hwcl === 'cold') && (
              <div className="mobile-form-group" style={{ marginBottom: 0 }}>
                <label className="mobile-form-label">Next Follow-up Date *</label>
                <input
                  type="date"
                  value={state.nextFollowupDate}
                  onChange={e => set('nextFollowupDate', e.target.value)}
                  min={istTodayISO()}
                  className="mobile-input"
                />
              </div>
            )}

            <div className="mobile-form-group" style={{ marginBottom: 0 }}>
              <label className="mobile-form-label">GRE Remarks</label>
              <textarea
                value={state.greRemarks}
                onChange={e => set('greRemarks', e.target.value)}
                placeholder="Initial reception notes..."
                className="mobile-textarea"
                rows={3}
              />
            </div>

            {smList.length > 1 && (
              <div className="mobile-form-group" style={{ marginBottom: 0 }}>
                <label className="mobile-form-label">Assigned SM</label>
                <select value={state.assignedSmId} onChange={e => set('assignedSmId', e.target.value)} className="mobile-input" style={{ cursor: 'pointer' }}>
                  <option value="">— Self —</option>
                  {smList.map(sm => <option key={sm.id} value={sm.id}>{sm.full_name}</option>)}
                </select>
              </div>
            )}

            {error && <p style={{ color: 'var(--color-danger)', fontSize: 13, margin: 0 }}>{error}</p>}
          </div>
        )}
      </div>

      {/* Sticky bottom nav — safe-bottom adds env(safe-area-inset-bottom) padding for iOS notch */}
      <div className="safe-bottom" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'white', borderTop: '1px solid var(--sales-border)',
        padding: '12px 20px', display: 'flex', gap: 10, zIndex: 10,
      }}>
        {state.step > 1 && (
          <button type="button" className="mobile-btn-option" style={{ flex: 1 }} onClick={() => { setError(''); dispatch({ type: 'PREV' }); }}>
            ← Back
          </button>
        )}

        {state.step === 1 ? (
          <button
            type="button"
            className="mobile-btn-option selected"
            style={{ flex: 1, minHeight: 52 }}
            onClick={handleMobileContinue}
            disabled={checking}
          >
            {checking ? 'Checking…' : 'Continue →'}
          </button>
        ) : state.step < 6 ? (
          <button
            type="button"
            className="mobile-btn-option selected"
            style={{ flex: 1, minHeight: 52 }}
            onClick={() => { setError(''); dispatch({ type: 'NEXT' }); }}
          >
            Next →
          </button>
        ) : (
          <button
            type="button"
            className="mobile-btn-option selected-gold"
            style={{ flex: 1, minHeight: 52, fontWeight: 800, fontSize: 15 }}
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? 'Submitting…' : 'Submit Walk-in ✓'}
          </button>
        )}
      </div>
    </div>
  );
}
