'use client';

import { useReducer, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CpSearchCombobox } from '@/components/sales/CpSearchCombobox';
import { createCpMeeting } from '@/lib/actions/sales/meetings';
import { MeetingTypeBadge } from '@/components/sales/MeetingTypeBadge';
import type { MeetingType, MeetingCategory } from '@/lib/schemas/sales';
import { istTodayISO } from '@/lib/utils/formatters';

type State = {
  projectId: string;
  meetingDate: string;
  meetingType: MeetingType | '';
  cpId: string | null;
  placeFrom: string;
  placeTo: string;
  kmTravelled: string;
  isInterested: boolean | null;
  rating: number | null;
  feedback: string;
};

type Action =
  | { type: 'SET'; key: keyof State; value: unknown }
  | { type: 'RESET' };

function reducer(state: State, action: Action): State {
  if (action.type === 'RESET') return init(state.projectId);
  return { ...state, [action.key]: action.value };
}

function init(projectId: string): State {
  return {
    projectId,
    meetingDate: istTodayISO(),
    meetingType: '',
    cpId: null,
    placeFrom: '',
    placeTo: '',
    kmTravelled: '',
    isInterested: null,
    rating: null,
    feedback: '',
  };
}

export default function NewMeetingPage() {
  const router = useRouter();
  const projectId = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('project') ?? ''
    : '';

  const [state, dispatch] = useReducer(reducer, projectId, init);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ category: MeetingCategory; type: MeetingType } | null>(null);
  const [error, setError] = useState('');

  function set(key: keyof State, value: unknown) {
    dispatch({ type: 'SET', key, value });
  }

  async function handleSubmit() {
    if (!state.meetingType || !state.cpId) {
      setError('Please select a meeting type and CP.');
      return;
    }
    setSubmitting(true);
    setError('');
    const res = await createCpMeeting({
      project_id: state.projectId,
      cp_id: state.cpId,
      meeting_date: state.meetingDate,
      meeting_type: state.meetingType as MeetingType,
      place_from: state.placeFrom || undefined,
      place_to: state.placeTo || undefined,
      km_travelled: state.kmTravelled ? parseFloat(state.kmTravelled) : undefined,
      is_interested: state.isInterested ?? undefined,
      rating: state.rating ?? undefined,
      feedback: state.feedback || undefined,
    });
    setSubmitting(false);
    if (!res.ok) { setError(res.error); return; }
    setResult({ category: res.data.meeting_category, type: res.data.meeting_type });
  }

  if (result) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-6 gap-6 max-w-sm mx-auto">
        <div className="w-full rounded-xl border bg-card p-6 text-center space-y-4">
          <div className="text-2xl">✓</div>
          <h2 className="text-lg font-semibold">Meeting Logged</h2>
          <MeetingTypeBadge type={result.type} category={result.category} className="text-sm" />
          <p className="text-sm text-muted-foreground">
            This was a <span className="font-semibold text-foreground">{result.category.toUpperCase()}</span> meeting for the month.
          </p>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => { setResult(null); dispatch({ type: 'RESET' }); }}>
              Log Another
            </Button>
            <Button className="flex-1" onClick={() => router.push(`/sales-marketing/meetings?project=${state.projectId}`)}>
              View All
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="border-b px-6 py-4 shrink-0">
        <h1 className="text-xl font-semibold tracking-tight">Log Meeting</h1>
        <p className="text-sm text-muted-foreground mt-0.5">CP DAR entry — mobile-first</p>
      </div>

      <div className="flex-1 p-4 max-w-lg space-y-5">
        {/* Date */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Date</label>
          <input
            type="date"
            value={state.meetingDate}
            onChange={e => set('meetingDate', e.target.value)}
            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Meeting Type — large tap targets */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Meeting Type</label>
          <div className="grid grid-cols-2 gap-3">
            {(['obm', 'ibm'] as const).map(t => (
              <button
                key={t}
                onClick={() => set('meetingType', t)}
                className={`h-14 rounded-xl border-2 text-base font-bold transition-all ${
                  state.meetingType === t
                    ? t === 'obm'
                      ? 'border-teal-500 bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-200'
                      : 'border-purple-500 bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-200'
                    : 'border-border hover:border-muted-foreground'
                }`}
              >
                {t.toUpperCase()}
                <div className="text-xs font-normal mt-0.5">
                  {t === 'obm' ? 'Outbound' : 'Inbound'}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* CP */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Channel Partner <span className="text-red-500">*</span></label>
          <CpSearchCombobox
            value={state.cpId}
            onChange={id => set('cpId', id)}
            projectId={state.projectId}
          />
        </div>

        {/* OBM-only fields */}
        {state.meetingType === 'obm' && (
          <div className="space-y-3 rounded-xl border bg-muted/30 p-4">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Travel Details (OBM)</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">From</label>
                <input
                  type="text"
                  value={state.placeFrom}
                  onChange={e => set('placeFrom', e.target.value)}
                  placeholder="Departure"
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">To</label>
                <input
                  type="text"
                  value={state.placeTo}
                  onChange={e => set('placeTo', e.target.value)}
                  placeholder="Destination"
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">KM Travelled</label>
              <input
                type="number"
                value={state.kmTravelled}
                onChange={e => set('kmTravelled', e.target.value)}
                placeholder="0"
                className="w-32 h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        )}

        {/* Interested? */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">CP Interested?</label>
          <div className="flex gap-3">
            {([{ v: true, l: 'Yes' }, { v: false, l: 'No' }, { v: null, l: 'Maybe' }] as const).map(opt => (
              <button
                key={String(opt.v)}
                onClick={() => set('isInterested', opt.v)}
                className={`flex-1 h-10 rounded-lg border text-sm font-medium transition-colors ${
                  state.isInterested === opt.v
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border hover:bg-accent'
                }`}
              >
                {opt.l}
              </button>
            ))}
          </div>
        </div>

        {/* Rating */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Rating</label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                onClick={() => set('rating', n)}
                className={`text-2xl transition-opacity ${state.rating && n <= state.rating ? 'opacity-100' : 'opacity-25 hover:opacity-60'}`}
              >
                ★
              </button>
            ))}
          </div>
        </div>

        {/* Feedback */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Feedback</label>
          <Textarea
            value={state.feedback}
            onChange={e => set('feedback', e.target.value)}
            placeholder="Notes on the meeting..."
            rows={3}
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button
          className="w-full h-12 text-base"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? 'Submitting...' : 'Log Meeting'}
        </Button>
      </div>
    </div>
  );
}
