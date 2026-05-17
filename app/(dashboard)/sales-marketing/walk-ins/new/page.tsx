'use client';

import { useReducer, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CpSearchCombobox } from '@/components/sales/CpSearchCombobox';
import { processWalkInIntake } from '@/lib/actions/sales/walk-ins';
import { lookupClientByMobile } from '@/lib/actions/sales/clients';
import type { LeadSource, Config, Purpose } from '@/lib/schemas/sales';

const TOTAL_STEPS = 7;

type FormState = {
  // Step 1
  mobile: string;
  existingClient: { first_name?: string; last_name?: string; id: string } | null;
  // Step 2
  firstName: string;
  lastName: string;
  email: string;
  accompaniedBy: 'alone' | 'family' | 'friends' | '';
  // Step 3
  source: LeadSource | '';
  subSource: string;
  cpId: string | null;
  // Step 4
  configuration: Config | '';
  budget: string;
  purpose: Purpose | '';
  possessionTimeframe: string;
  // Step 5
  ageBracket: string;
  occupation: string;
  employmentType: string;
  // Step 6
  assignedSmId: string;
  visitType: string;
  greRemarks: string;
};

function init(projectId: string): FormState {
  return {
    mobile: '', existingClient: null,
    firstName: '', lastName: '', email: '', accompaniedBy: '',
    source: '', subSource: '', cpId: null,
    configuration: '', budget: '', purpose: '', possessionTimeframe: '',
    ageBracket: '', occupation: '', employmentType: '',
    assignedSmId: '', visitType: 'site_visit', greRemarks: '',
  };
}

export default function NewWalkInPage() {
  const router = useRouter();
  const projectId = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('project') ?? ''
    : '';

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(init(projectId));
  const [checkingMobile, setCheckingMobile] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ scenario: number; walkInId: string; visitNumber: number; isNewClient: boolean } | null>(null);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function checkMobile() {
    if (form.mobile.replace(/\D/g, '').length < 10) { setError('Enter a valid 10-digit mobile number.'); return; }
    setCheckingMobile(true);
    setError('');
    const existing = await lookupClientByMobile(form.mobile);
    if (existing) {
      set('existingClient', {
        id: existing.id,
        first_name: existing.first_name ?? undefined,
        last_name: existing.last_name ?? undefined,
      });
      set('firstName', existing.first_name ?? '');
      set('lastName', existing.last_name ?? '');
    } else {
      set('existingClient', null);
    }
    setCheckingMobile(false);
    setStep(2);
  }

  async function handleSubmit() {
    if (form.source === 'cp' && !form.cpId) { setError('Please select a CP.'); return; }
    setSubmitting(true);
    setError('');
    const res = await processWalkInIntake({
      project_id: projectId,
      mobile: form.mobile,
      first_name: form.firstName || undefined,
      last_name: form.lastName || undefined,
      email: form.email || undefined,
      accompanied_by: (form.accompaniedBy || undefined) as any,
      source: form.source as LeadSource,
      sub_source: form.subSource || undefined,
      cp_id: form.cpId ?? undefined,
      configuration: (form.configuration || undefined) as Config | undefined,
      budget: form.budget || undefined,
      purpose: (form.purpose || undefined) as Purpose | undefined,
      possession_timeframe: form.possessionTimeframe || undefined,
      age_bracket: (form.ageBracket || undefined) as any,
      occupation: form.occupation || undefined,
      employment_type: (form.employmentType || undefined) as any,
      visit_type: (form.visitType as any) || 'site_visit',
      assigned_sm_id: form.assignedSmId || undefined,
      gre_remarks: form.greRemarks || undefined,
    });
    setSubmitting(false);
    if (!res.ok) { setError(res.error); return; }
    setResult({ scenario: res.data.scenario, walkInId: res.data.walkInId, visitNumber: res.data.visitNumber, isNewClient: res.data.isNewClient });
    setStep(7);
  }

  const SCENARIO_MESSAGES: Record<number, string> = {
    2: 'New client registered, walk-in created, and site visit #1 logged.',
    3: 'Site visit #1 logged for existing client.',
    4: `Revisit logged — visit #${result?.visitNumber ?? 2} for this client.`,
    5: 'Fresh engagement started — new walk-in and visit #1 logged.',
  };

  if (result) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-6 gap-6 max-w-sm mx-auto">
        <div className="w-full rounded-xl border bg-card p-6 text-center space-y-4">
          <div className="text-4xl">✓</div>
          <h2 className="text-lg font-semibold">Walk-in Logged</h2>
          <p className="text-sm text-muted-foreground">{SCENARIO_MESSAGES[result.scenario] ?? 'Walk-in processed successfully.'}</p>
          {result.visitNumber > 1 && (
            <div className="inline-flex items-center rounded-full bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1">
              Visit #{result.visitNumber} — Revisit
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => router.push(`/sales-marketing/walk-ins?project=${projectId}`)}>
              View MIS
            </Button>
            <Button className="flex-1" onClick={() => router.push(`/sales-marketing/walk-ins/${result.walkInId}`)}>
              View Record
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const STEP_LABELS = ['Mobile', 'Details', 'Source', 'Requirements', 'Demographics', 'SM & Visit', 'Confirm'];

  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* Header with step indicator */}
      <div className="border-b px-6 py-4 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-semibold tracking-tight">New Walk-in</h1>
          <span className="text-xs text-muted-foreground">Step {step} of 6</span>
        </div>
        <div className="flex gap-1">
          {[1,2,3,4,5,6].map(s => (
            <div key={s} className={`h-1 flex-1 rounded-full transition-all ${s < step ? 'bg-primary' : s === step ? 'bg-primary/60' : 'bg-muted'}`} />
          ))}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">{STEP_LABELS[step - 1]}</div>
      </div>

      <div className="flex-1 p-4 max-w-lg space-y-5">
        {/* Step 1: Mobile */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Mobile Number <span className="text-red-500">*</span></label>
              <input
                type="tel"
                value={form.mobile}
                onChange={e => set('mobile', e.target.value)}
                onKeyDown={e => e.key === 'Enter' && checkMobile()}
                placeholder="10-digit mobile"
                className="w-full h-12 rounded-lg border border-input bg-background px-4 text-base focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button className="w-full h-12" onClick={checkMobile} disabled={checkingMobile}>
              {checkingMobile ? 'Checking...' : 'Continue →'}
            </Button>
          </div>
        )}

        {/* Step 2: Basic Details */}
        {step === 2 && (
          <div className="space-y-4">
            {form.existingClient && (
              <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 px-4 py-3 text-sm text-blue-800 dark:text-blue-200">
                Existing client found: <strong>{[form.existingClient.first_name, form.existingClient.last_name].filter(Boolean).join(' ')}</strong>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">First Name</label>
                <input type="text" value={form.firstName} onChange={e => set('firstName', e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Last Name</label>
                <input type="text" value={form.lastName} onChange={e => set('lastName', e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Email</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Accompanied By</label>
              <div className="grid grid-cols-3 gap-2">
                {(['alone', 'family', 'friends'] as const).map(v => (
                  <button key={v} onClick={() => set('accompaniedBy', v)}
                    className={`h-10 rounded-lg border text-sm capitalize transition-colors ${form.accompaniedBy === v ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-accent'}`}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Source */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Lead Source <span className="text-red-500">*</span></label>
              <div className="grid grid-cols-2 gap-3">
                {(['cp', 'direct'] as const).map(s => (
                  <button key={s} onClick={() => set('source', s)}
                    className={`h-14 rounded-xl border-2 text-sm font-bold uppercase transition-all ${form.source === s ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-muted-foreground'}`}>
                    {s === 'cp' ? 'Channel Partner' : 'Direct'}
                    <div className="text-xs font-normal mt-0.5 normal-case">
                      {s === 'cp' ? 'Referred by broker' : 'Self walk-in'}
                    </div>
                  </button>
                ))}
              </div>
            </div>
            {form.source === 'cp' && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Channel Partner <span className="text-red-500">*</span></label>
                <CpSearchCombobox value={form.cpId} onChange={id => set('cpId', id)} projectId={projectId} />
              </div>
            )}
          </div>
        )}

        {/* Step 4: Requirements */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Configuration</label>
              <div className="grid grid-cols-3 gap-2 flex-wrap">
                {(['1bhk', '2bhk', '3bhk', '2bhk_jodi', 'duplex'] as Config[]).map(c => (
                  <button key={c} onClick={() => set('configuration', c)}
                    className={`h-10 rounded-lg border text-xs font-semibold transition-colors ${form.configuration === c ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-accent'}`}>
                    {c === '1bhk' ? '1 BHK' : c === '2bhk' ? '2 BHK' : c === '3bhk' ? '3 BHK' : c === '2bhk_jodi' ? '2BHK Jodi' : 'Duplex'}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Budget Range</label>
              <input type="text" value={form.budget} onChange={e => set('budget', e.target.value)} placeholder="e.g. 1.8 - 2.2 Cr"
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Purpose</label>
              <div className="grid grid-cols-3 gap-2">
                {(['self_use', 'investment', 'both'] as const).map(p => (
                  <button key={p} onClick={() => set('purpose', p)}
                    className={`h-10 rounded-lg border text-xs font-medium capitalize transition-colors ${form.purpose === p ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-accent'}`}>
                    {p === 'self_use' ? 'Self Use' : p === 'investment' ? 'Investment' : 'Both'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Demographics */}
        {step === 5 && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">Optional — helps with analytics and targeting.</p>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Age Bracket</label>
              <div className="grid grid-cols-3 gap-2">
                {[['below_25','<25'],['25_30','25–30'],['31_40','31–40'],['41_50','41–50'],['51_60','51–60'],['above_60','60+']].map(([v,l]) => (
                  <button key={v} onClick={() => set('ageBracket', v)}
                    className={`h-9 rounded-lg border text-xs font-medium transition-colors ${form.ageBracket === v ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-accent'}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Occupation</label>
              <input type="text" value={form.occupation} onChange={e => set('occupation', e.target.value)} placeholder="e.g. Doctor, IT professional"
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          </div>
        )}

        {/* Step 6: SM + Visit */}
        {step === 6 && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Visit Type</label>
              <div className="grid grid-cols-2 gap-2">
                {[['site_visit','Site Visit'],['home_visit','Home Visit'],['video_call','Video Call'],['office_visit','Office Visit']].map(([v,l]) => (
                  <button key={v} onClick={() => set('visitType', v)}
                    className={`h-10 rounded-lg border text-sm transition-colors ${form.visitType === v ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-accent'}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">GRE Remarks (optional)</label>
              <textarea value={form.greRemarks} onChange={e => set('greRemarks', e.target.value)} placeholder="Initial reception notes..."
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        {/* Navigation */}
        {step > 1 && step < 7 && (
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => { setError(''); setStep(s => s - 1); }}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            {step < 6 ? (
              <Button className="flex-1" onClick={() => { setError(''); setStep(s => s + 1); }}>
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button className="flex-1" onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit Walk-in'}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
