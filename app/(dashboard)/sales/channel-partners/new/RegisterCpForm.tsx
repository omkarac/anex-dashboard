'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerChannelPartner } from '@/lib/actions/sales/channel-partners';
import { RegisterCpInputSchema, type RegisterCpInput } from '@/lib/schemas/sales';

const FIRM_TYPES = [
  { value: 'individual', label: 'Individual' },
  { value: 'proprietorship', label: 'Proprietorship' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'llp', label: 'LLP' },
  { value: 'private_limited', label: 'Pvt. Ltd.' },
  { value: 'public_limited', label: 'Public Ltd.' },
] as const;

const CATEGORIES = [
  { value: 'cp', label: 'CP', desc: 'Channel Partner' },
  { value: 'rcp', label: 'RCP', desc: 'Registered CP' },
  { value: 'icp', label: 'ICP', desc: 'Individual CP' },
] as const;

const ZONES = [
  { value: 'kdmc', label: 'KDMC' },
  { value: 'thane', label: 'Thane' },
  { value: 'central', label: 'Central' },
  { value: 'navi_mumbai', label: 'Navi Mumbai' },
  { value: 'south_mumbai', label: 'South Mumbai' },
  { value: 'western_suburbs', label: 'Western Suburbs' },
  { value: 'eastern_suburbs', label: 'Eastern Suburbs' },
  { value: 'other', label: 'Other' },
] as const;

const BIZ_MODELS = [
  'residential', 'commercial', 'luxury', 'affordable', 'plots', 'rental', 'investment',
];

export function RegisterCpForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [aliasInput, setAliasInput] = useState('');
  const [aliases, setAliases] = useState<string[]>([]);
  const [bizModels, setBizModels] = useState<string[]>([]);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<RegisterCpInput>({
    resolver: zodResolver(RegisterCpInputSchema),
    defaultValues: { firm_type: 'individual', category: 'cp', aliases: [], business_model: [] },
  });

  const firmType = watch('firm_type');
  const category = watch('category');

  function addAlias() {
    const v = aliasInput.trim();
    if (!v || aliases.includes(v)) return;
    const next = [...aliases, v];
    setAliases(next);
    setValue('aliases', next);
    setAliasInput('');
  }

  function removeAlias(a: string) {
    const next = aliases.filter(x => x !== a);
    setAliases(next);
    setValue('aliases', next);
  }

  function toggleBizModel(model: string) {
    const next = bizModels.includes(model) ? bizModels.filter(m => m !== model) : [...bizModels, model];
    setBizModels(next);
    setValue('business_model', next);
  }

  const onSubmit = handleSubmit(data => {
    setServerError(null);
    startTransition(async () => {
      const result = await registerChannelPartner(data);
      if (result.ok) {
        router.push(`/sales/channel-partners/${result.data.id}`);
      } else {
        setServerError(result.error);
      }
    });
  });

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

      {/* Canonical Name */}
      <div className="mobile-form-group">
        <label className="mobile-form-label">Canonical Name *</label>
        <input
          {...register('canonical_name')}
          className="mobile-input"
          placeholder="e.g. Rahul Enterprises"
          autoComplete="off"
        />
        {errors.canonical_name && (
          <span style={{ fontSize: 12, color: 'var(--color-danger)' }}>{errors.canonical_name.message}</span>
        )}
      </div>

      {/* Aliases */}
      <div className="mobile-form-group">
        <label className="mobile-form-label">Also Known As (aliases)</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={aliasInput}
            onChange={e => setAliasInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addAlias(); } }}
            className="mobile-input"
            style={{ flex: 1 }}
            placeholder="Type alias and press Add"
          />
          <button
            type="button"
            onClick={addAlias}
            style={{
              height: 48, padding: '0 16px', borderRadius: 'var(--r)',
              border: '1.5px solid var(--sales-border)', background: 'white',
              fontWeight: 700, fontSize: 13, cursor: 'pointer', color: 'var(--sales-txt2)',
              fontFamily: 'inherit', flexShrink: 0,
            }}
          >
            Add
          </button>
        </div>
        {aliases.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
            {aliases.map(a => (
              <span
                key={a}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '4px 10px', borderRadius: 20, background: '#EEF2F7',
                  fontSize: 12, fontWeight: 600, color: 'var(--sales-txt2)',
                }}
              >
                {a}
                <button
                  type="button"
                  onClick={() => removeAlias(a)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1, color: 'var(--sales-txt3)', fontSize: 14 }}
                >×</button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Category */}
      <div className="mobile-form-group">
        <label className="mobile-form-label">Category *</label>
        <div className="mobile-btn-group">
          {CATEGORIES.map(c => (
            <button
              key={c.value}
              type="button"
              onClick={() => setValue('category', c.value)}
              className={`mobile-btn-option${category === c.value ? ' selected' : ''}`}
              style={{ flex: 1 }}
            >
              <div style={{ fontWeight: 700 }}>{c.label}</div>
              <div style={{ fontSize: 10, fontWeight: 500, opacity: .75 }}>{c.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Firm Type */}
      <div className="mobile-form-group">
        <label className="mobile-form-label">Firm Type *</label>
        <div className="mobile-btn-group">
          {FIRM_TYPES.map(f => (
            <button
              key={f.value}
              type="button"
              onClick={() => setValue('firm_type', f.value)}
              className={`mobile-btn-option${firmType === f.value ? ' selected' : ''}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Mobile */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="mobile-form-group" style={{ marginBottom: 0 }}>
          <label className="mobile-form-label">Primary Mobile</label>
          <input
            {...register('mobile_primary')}
            className="mobile-input"
            inputMode="numeric"
            placeholder="10-digit number"
          />
          {errors.mobile_primary && (
            <span style={{ fontSize: 12, color: 'var(--color-danger)' }}>{errors.mobile_primary.message}</span>
          )}
        </div>
        <div className="mobile-form-group" style={{ marginBottom: 0 }}>
          <label className="mobile-form-label">Alternate Mobile</label>
          <input
            {...register('mobile_alternate')}
            className="mobile-input"
            inputMode="numeric"
            placeholder="Optional"
          />
        </div>
      </div>

      {/* Email */}
      <div className="mobile-form-group">
        <label className="mobile-form-label">Email</label>
        <input
          {...register('email')}
          type="email"
          className="mobile-input"
          placeholder="Optional"
        />
      </div>

      {/* Zone */}
      <div className="mobile-form-group">
        <label className="mobile-form-label">Zone</label>
        <select
          {...register('zone')}
          style={{
            height: 48, padding: '0 14px',
            border: '1.5px solid var(--sales-border)', borderRadius: 'var(--r)',
            fontSize: 14, fontFamily: 'inherit', color: 'var(--sales-txt)',
            background: 'white', width: '100%', cursor: 'pointer',
          }}
        >
          <option value="">Select zone</option>
          {ZONES.map(z => <option key={z.value} value={z.value}>{z.label}</option>)}
        </select>
      </div>

      {/* Sub Zone + Micromarket */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="mobile-form-group" style={{ marginBottom: 0 }}>
          <label className="mobile-form-label">Sub Zone</label>
          <input {...register('sub_zone')} className="mobile-input" placeholder="e.g. Dombivli East" />
        </div>
        <div className="mobile-form-group" style={{ marginBottom: 0 }}>
          <label className="mobile-form-label">Micromarket</label>
          <input {...register('micromarket')} className="mobile-input" placeholder="e.g. Panchpakhadi" />
        </div>
      </div>

      {/* RERA / PAN / GST */}
      <div className="mobile-form-group">
        <label className="mobile-form-label">RERA Number</label>
        <input {...register('rera_number')} className="mobile-input" placeholder="Optional" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="mobile-form-group" style={{ marginBottom: 0 }}>
          <label className="mobile-form-label">PAN</label>
          <input {...register('pan_number')} className="mobile-input" placeholder="Optional" style={{ textTransform: 'uppercase' }} />
        </div>
        <div className="mobile-form-group" style={{ marginBottom: 0 }}>
          <label className="mobile-form-label">GST</label>
          <input {...register('gst_number')} className="mobile-input" placeholder="Optional" />
        </div>
      </div>

      {/* Business Models */}
      <div className="mobile-form-group">
        <label className="mobile-form-label">Business Models</label>
        <div className="mobile-btn-group">
          {BIZ_MODELS.map(m => (
            <button
              key={m}
              type="button"
              onClick={() => toggleBizModel(m)}
              className={`mobile-btn-option${bizModels.includes(m) ? ' selected' : ''}`}
              style={{ textTransform: 'capitalize' }}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isPending}
        style={{
          width: '100%', height: 52, borderRadius: 'var(--r)',
          border: 'none', background: isPending ? 'var(--sales-border)' : 'var(--anex-navy)',
          color: 'white', fontSize: 15, fontWeight: 800,
          cursor: isPending ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit', transition: 'background .15s',
        }}
      >
        {isPending ? 'Registering...' : 'Register Channel Partner'}
      </button>
    </form>
  );
}
