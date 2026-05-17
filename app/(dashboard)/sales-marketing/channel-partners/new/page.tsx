'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { checkCpDuplication, registerChannelPartner } from '@/lib/actions/sales/channel-partners';
import type { DedupResult } from '@/lib/actions/sales/channel-partners';
import type { CpCategory, CpFirmType, Zone } from '@/lib/schemas/sales';

// Re-export missing types
type CpFirmTypeVal = 'individual' | 'private_limited' | 'public_limited' | 'partnership' | 'llp' | 'proprietorship';
type ZoneVal = 'kdmc' | 'thane' | 'central' | 'navi_mumbai' | 'south_mumbai' | 'western_suburbs' | 'eastern_suburbs' | 'other';

export default function NewCpPage() {
  const router = useRouter();
  const projectId = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('project') ?? ''
    : '';

  const [canonicalName, setCanonicalName] = useState('');
  const [firmType, setFirmType] = useState<CpFirmTypeVal>('individual');
  const [category, setCategory] = useState<CpCategory>('cp');
  const [mobile, setMobile] = useState('');
  const [rera, setRera] = useState('');
  const [pan, setPan] = useState('');
  const [zone, setZone] = useState<ZoneVal | ''>('');
  const [subZone, setSubZone] = useState('');

  const [dedup, setDedup] = useState<DedupResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Debounced dedup check on name change
  useEffect(() => {
    if (canonicalName.length < 3) { setDedup(null); return; }
    const t = setTimeout(async () => {
      setChecking(true);
      const result = await checkCpDuplication({ name: canonicalName });
      setDedup(result);
      setChecking(false);
    }, 500);
    return () => clearTimeout(t);
  }, [canonicalName]);

  async function handleSubmit() {
    if (!canonicalName.trim()) { setError('CP name is required.'); return; }
    if (dedup?.found) { setError('A similar CP already exists. Check the list above before registering.'); return; }

    setSubmitting(true);
    setError('');
    const res = await registerChannelPartner({
      canonical_name: canonicalName.trim(),
      firm_type: firmType,
      category,
      mobile_primary: mobile || undefined,
      rera_number: rera || undefined,
      pan_number: pan || undefined,
      zone: zone || undefined,
      sub_zone: subZone || undefined,
    });
    setSubmitting(false);
    if (!res.ok) { setError(res.error); return; }
    router.push(`/sales-marketing/channel-partners/${res.data.id}?project=${projectId}`);
  }

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="border-b px-6 py-4 shrink-0">
        <h1 className="text-xl font-semibold tracking-tight">Register Channel Partner</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Add a new CP to the master database</p>
      </div>

      <div className="flex-1 p-6 max-w-lg space-y-5">
        {/* Name + dedup */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Canonical Name <span className="text-red-500">*</span></label>
          <div className="relative">
            <input
              type="text"
              value={canonicalName}
              onChange={e => setCanonicalName(e.target.value)}
              placeholder="Full firm name (canonical form)"
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {checking && (
              <span className="absolute right-3 top-2.5 text-xs text-muted-foreground">Checking...</span>
            )}
          </div>

          {/* Dedup warning */}
          {dedup?.found && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-200">
                <AlertTriangle className="h-4 w-4" />
                Similar CP{dedup.matches.length > 1 ? 's' : ''} already exist
              </div>
              {dedup.matches.map(m => (
                <div key={m.id} className="text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2">
                  <span>·</span>
                  <a href={`/sales-marketing/channel-partners/${m.id}`} className="font-medium hover:underline">
                    {m.canonical_name}
                  </a>
                  <span className="uppercase text-xs opacity-70">{m.category}</span>
                </div>
              ))}
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Only proceed if this is genuinely a different CP.
              </p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Firm Type</label>
            <Select value={firmType} onValueChange={v => setFirmType(v as CpFirmTypeVal)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="individual">Individual</SelectItem>
                <SelectItem value="private_limited">Pvt. Ltd.</SelectItem>
                <SelectItem value="proprietorship">Proprietorship</SelectItem>
                <SelectItem value="partnership">Partnership</SelectItem>
                <SelectItem value="llp">LLP</SelectItem>
                <SelectItem value="public_limited">Public Ltd.</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Category</label>
            <div className="flex gap-2">
              {(['cp', 'rcp', 'icp'] as CpCategory[]).map(c => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`flex-1 h-10 rounded-lg border text-xs font-bold uppercase transition-colors ${category === c ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-accent'}`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium">Mobile</label>
            <input type="tel" value={mobile} onChange={e => setMobile(e.target.value)} placeholder="10-digit"
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">RERA Number</label>
            <input type="text" value={rera} onChange={e => setRera(e.target.value)} placeholder="Optional"
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Zone</label>
            <Select value={zone} onValueChange={v => setZone(v as ZoneVal)}>
              <SelectTrigger><SelectValue placeholder="Select zone..." /></SelectTrigger>
              <SelectContent>
                {[['western_suburbs','Western Suburbs'],['eastern_suburbs','Eastern Suburbs'],['central','Central'],['south_mumbai','South Mumbai'],['navi_mumbai','Navi Mumbai'],['thane','Thane'],['kdmc','KDMC'],['other','Other']].map(([v,l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Sub-Zone</label>
            <input type="text" value={subZone} onChange={e => setSubZone(e.target.value)} placeholder="e.g. Andheri W"
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button className="w-full h-12" onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Registering...' : 'Register Channel Partner'}
        </Button>
      </div>
    </div>
  );
}
