'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LeadStatusBadge } from '@/components/sales/LeadStatusBadge';
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

const ALL_STATUSES: LeadStatus[] = ['hot', 'warm', 'cold', 'lost', 'booked'];

interface UpdateStatusFormProps {
  walkInId: string;
  currentStatus: LeadStatus;
  currentRemark: string;
}

export function UpdateStatusForm({ walkInId, currentStatus, currentRemark }: UpdateStatusFormProps) {
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

  return (
    <div className="rounded-lg border bg-card p-5">
      <h2 className="text-sm font-semibold mb-4">Update Status & Remark</h2>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Status</label>
          <div className="flex flex-wrap gap-2">
            {ALL_STATUSES.map(s => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`transition-all ${status === s ? 'ring-2 ring-primary ring-offset-1' : 'opacity-60 hover:opacity-100'}`}
              >
                <LeadStatusBadge status={s} />
              </button>
            ))}
          </div>
        </div>

        {status === 'lost' && (
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Lost Reason <span className="text-red-500">*</span></label>
            <Select value={lostReason} onValueChange={v => setLostReason(v as LostReason)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select reason..." />
              </SelectTrigger>
              <SelectContent>
                {LOST_REASONS.map(r => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Remark <span className="text-red-500">*</span></label>
          <Textarea
            value={remark}
            onChange={e => setRemark(e.target.value)}
            placeholder="Add a note about this status update..."
            rows={2}
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button onClick={handleUpdate} disabled={submitting}>
          {submitting ? 'Updating...' : 'Update Status'}
        </Button>
      </div>
    </div>
  );
}
