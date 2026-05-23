'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createCpMeeting } from '@/lib/actions/sales/meetings';
import { CreateMeetingInputSchema, type CreateMeetingInput, type CpStage } from '@/lib/schemas/sales';
import { istTodayISO } from '@/lib/utils/formatters';
import { CpSearchCombobox } from '@/components/sales/CpSearchCombobox';
import type { SalesProject } from '@/lib/schemas/sales';

const TRAVEL_MODES = [
  { value: 'walk', label: 'Walk' },
  { value: 'auto', label: 'Auto' },
  { value: 'taxi', label: 'Taxi' },
  { value: 'own_car', label: 'Own Car' },
  { value: 'public', label: 'Public' },
] as const;

const CP_STAGE_OPTIONS: { value: CpStage; label: string }[] = [
  { value: 'prospect', label: 'Prospect' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

interface Props {
  projects: SalesProject[];
  defaultCpId?: string;
}

export function DarForm({ projects, defaultCpId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const defaultProjectId = searchParams.get('project') ?? projects[0]?.id ?? '';

  const { register, handleSubmit, setValue, watch, control, formState: { errors } } = useForm<CreateMeetingInput>({
    resolver: zodResolver(CreateMeetingInputSchema),
    defaultValues: {
      project_id: defaultProjectId,
      cp_id: defaultCpId ?? '',
      meeting_date: istTodayISO(),
      meeting_type: undefined,
      nri_lead: false,
    },
  });

  const meetingType = watch('meeting_type');
  const travelMode = watch('travel_mode');
  const isInterested = watch('is_interested');
  const cpStageUpdated = watch('cp_stage_updated_to');
  const rating = watch('rating');

  const onSubmit = handleSubmit(data => {
    setServerError(null);
    startTransition(async () => {
      const result = await createCpMeeting(data);
      if (result.ok) {
        setSuccess(true);
        setTimeout(() => router.push('/sales/meetings'), 1200);
      } else {
        setServerError(result.error);
      }
    });
  });

  if (success) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 24px' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--sales-txt)' }}>Meeting Logged</div>
        <div style={{ fontSize: 13, color: 'var(--sales-txt3)', marginTop: 4 }}>Redirecting...</div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {serverError && (
        <div style={{
          padding: '12px 16px', borderRadius: 'var(--r)',
          background: 'var(--color-danger-bg)', color: 'var(--color-danger)',
          fontSize: 13, fontWeight: 600, border: '1px solid #FECACA',
        }}>
          {serverError}
        </div>
      )}

      {/* Project */}
      {projects.length > 1 && (
        <div className="mobile-form-group">
          <label className="mobile-form-label">Project *</label>
          <select
            {...register('project_id')}
            style={{
              height: 48, padding: '0 14px',
              border: '1.5px solid var(--sales-border)', borderRadius: 'var(--r)',
              fontSize: 14, fontFamily: 'inherit', color: 'var(--sales-txt)',
              background: 'white', width: '100%', cursor: 'pointer',
            }}
          >
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {errors.project_id && (
            <span style={{ fontSize: 12, color: 'var(--color-danger)' }}>{errors.project_id.message}</span>
          )}
        </div>
      )}

      {/* Meeting Type — 56px OBM / IBM button group */}
      <div className="mobile-form-group">
        <label className="mobile-form-label">Meeting Type *</label>
        <div style={{ display: 'flex', gap: 10 }}>
          {([
            { value: 'obm', label: 'OBM', desc: 'Out-Bound Meeting' },
            { value: 'ibm', label: 'IBM', desc: 'In-Bound Meeting' },
          ] as const).map(t => (
            <button
              key={t.value}
              type="button"
              onClick={() => setValue('meeting_type', t.value)}
              style={{
                flex: 1, minHeight: 56, borderRadius: 'var(--r)',
                border: `2px solid ${meetingType === t.value ? 'var(--anex-navy)' : 'var(--sales-border)'}`,
                background: meetingType === t.value ? 'var(--anex-navy)' : 'white',
                color: meetingType === t.value ? 'white' : 'var(--sales-txt2)',
                cursor: 'pointer', transition: 'all .15s',
                fontFamily: 'inherit', padding: '8px 12px',
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1 }}>{t.label}</div>
              <div style={{ fontSize: 10, fontWeight: 500, opacity: .75, marginTop: 3 }}>{t.desc}</div>
            </button>
          ))}
        </div>
        {errors.meeting_type && (
          <span style={{ fontSize: 12, color: 'var(--color-danger)' }}>Please select a meeting type</span>
        )}
      </div>

      {/* CP Search */}
      <div className="mobile-form-group">
        <label className="mobile-form-label">Channel Partner *</label>
        <Controller
          name="cp_id"
          control={control}
          render={({ field }) => (
            <div style={{ position: 'relative' }}>
              <CpSearchCombobox
                value={field.value || null}
                onChange={field.onChange}
                placeholder="Search CP by name..."
              />
            </div>
          )}
        />
        {errors.cp_id && (
          <span style={{ fontSize: 12, color: 'var(--color-danger)' }}>{errors.cp_id.message}</span>
        )}
        <span style={{ fontSize: 11, color: 'var(--sales-txt3)' }}>
          Meeting Category (Unique/Repeat) is auto-computed server-side.
        </span>
      </div>

      {/* Date */}
      <div className="mobile-form-group">
        <label className="mobile-form-label">Meeting Date *</label>
        <input
          {...register('meeting_date')}
          type="date"
          className="mobile-input"
          max={istTodayISO()}
        />
        {errors.meeting_date && (
          <span style={{ fontSize: 12, color: 'var(--color-danger)' }}>{errors.meeting_date.message}</span>
        )}
      </div>

      {/* Place From / To — stacks on mobile */}
      <div className="grid-2">
        <div className="mobile-form-group" style={{ marginBottom: 0 }}>
          <label className="mobile-form-label">Place From</label>
          <input {...register('place_from')} className="mobile-input" placeholder="Starting point" />
        </div>
        <div className="mobile-form-group" style={{ marginBottom: 0 }}>
          <label className="mobile-form-label">Place To</label>
          <input {...register('place_to')} className="mobile-input" placeholder="Meeting location" />
        </div>
      </div>

      {/* Travel Mode */}
      <div className="mobile-form-group">
        <label className="mobile-form-label">Travel Mode</label>
        <div className="mobile-btn-group">
          {TRAVEL_MODES.map(m => (
            <button
              key={m.value}
              type="button"
              onClick={() => setValue('travel_mode', travelMode === m.value ? undefined : m.value)}
              className={`mobile-btn-option${travelMode === m.value ? ' selected' : ''}`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* KMs */}
      <div className="mobile-form-group">
        <label className="mobile-form-label">KMs Travelled</label>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          step={0.1}
          className="mobile-input"
          placeholder="e.g. 12.5"
          onChange={e => {
            const v = parseFloat(e.target.value);
            setValue('km_travelled', isNaN(v) ? undefined : v);
          }}
        />
      </div>

      {/* Interested */}
      <div className="mobile-form-group">
        <label className="mobile-form-label">CP Interested?</label>
        <div className="mobile-btn-group">
          {([
            { value: true, label: 'Yes, Interested' },
            { value: false, label: 'Not Interested' },
          ] as const).map(opt => (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() => setValue('is_interested', isInterested === opt.value ? undefined : opt.value)}
              className={`mobile-btn-option${isInterested === opt.value ? ' selected' : ''}`}
              style={{ flex: 1 }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* NRI Lead */}
      <div className="mobile-form-group">
        <label className="mobile-form-label">NRI Lead?</label>
        <div className="mobile-btn-group">
          {([
            { value: false, label: 'No' },
            { value: true, label: 'Yes — NRI' },
          ] as const).map(opt => {
            const nriLead = watch('nri_lead');
            return (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => setValue('nri_lead', opt.value)}
                className={`mobile-btn-option${nriLead === opt.value ? ' selected' : ''}`}
                style={{ flex: 1 }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Rating */}
      <div className="mobile-form-group">
        <label className="mobile-form-label">Meeting Rating</label>
        <div style={{ display: 'flex', gap: 8 }}>
          {([1, 2, 3, 4, 5] as const).map(n => (
            <button
              key={n}
              type="button"
              onClick={() => setValue('rating', rating === n ? undefined : n)}
              style={{
                flex: 1, height: 44, borderRadius: 'var(--r)',
                border: `1.5px solid ${rating !== undefined && rating >= n ? 'var(--anex-gold)' : 'var(--sales-border)'}`,
                background: rating !== undefined && rating >= n ? 'var(--anex-gold)' : 'white',
                color: rating !== undefined && rating >= n ? 'var(--anex-navy)' : 'var(--sales-txt3)',
                fontSize: 16, fontWeight: 800, cursor: 'pointer',
                transition: 'all .15s', fontFamily: 'inherit',
              }}
            >
              ★
            </button>
          ))}
        </div>
        <span style={{ fontSize: 11, color: 'var(--sales-txt3)' }}>
          {rating ? `${rating} / 5` : 'Optional'}
        </span>
      </div>

      {/* CP Stage Update */}
      <div className="mobile-form-group">
        <label className="mobile-form-label">Update CP Stage (optional)</label>
        <div className="mobile-btn-group">
          {CP_STAGE_OPTIONS.map(s => (
            <button
              key={s.value}
              type="button"
              onClick={() => setValue('cp_stage_updated_to', cpStageUpdated === s.value ? undefined : s.value)}
              className={`mobile-btn-option${cpStageUpdated === s.value ? ' selected' : ''}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Feedback */}
      <div className="mobile-form-group">
        <label className="mobile-form-label">Feedback / Notes</label>
        <textarea
          {...register('feedback')}
          className="mobile-textarea"
          rows={3}
          placeholder="CP reaction, discussion points, follow-up action..."
        />
        {errors.feedback && (
          <span style={{ fontSize: 12, color: 'var(--color-danger)' }}>{errors.feedback.message}</span>
        )}
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isPending}
        style={{
          width: '100%', height: 56, borderRadius: 'var(--r)',
          border: 'none',
          background: isPending ? 'var(--sales-border)' : 'var(--anex-navy)',
          color: 'white', fontSize: 16, fontWeight: 800,
          cursor: isPending ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit', transition: 'background .15s',
          position: 'sticky', bottom: 16,
          boxShadow: '0 4px 16px rgba(27,42,74,.3)',
        }}
      >
        {isPending ? 'Logging Meeting...' : 'Log DAR Meeting'}
      </button>
    </form>
  );
}
