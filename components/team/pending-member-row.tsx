'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { activateMember } from '@/lib/actions/team';
import type { TeamMemberWithWorkload, MemberDepartment } from '@/lib/queries/team';

type Props = {
  member: TeamMemberWithWorkload;
  isCurrentUserAdmin: boolean;
};

export function PendingMemberRow({ member, isCurrentUserAdmin }: Props) {
  const [role, setRole] = useState('member');
  const [department, setDepartment] = useState<MemberDepartment>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function approve() {
    setError(null);
    startTransition(async () => {
      const res = await activateMember(member.id, role, department);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <tr className="group border-b last:border-0 transition-colors hover:bg-muted/20">
      {/* Member */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-[#B45309]/10 text-[#B45309] flex items-center justify-center text-sm font-medium shrink-0">
            {member.full_name[0]?.toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-medium">{member.full_name}</p>
            <p className="text-xs text-muted-foreground">{member.email}</p>
          </div>
        </div>
      </td>

      {/* Role picker (local until Approve) */}
      <td className="px-4 py-3">
        {isCurrentUserAdmin ? (
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            disabled={isPending}
            className="h-7 rounded border border-input bg-background px-2 text-xs disabled:opacity-50"
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
            <option value="sales_manager">Sales Manager</option>
            <option value="sales_head">Sales Head</option>
            <option value="sales_admin">Sales Admin</option>
          </select>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>

      {/* Department picker (required to approve) */}
      <td className="px-4 py-3">
        {isCurrentUserAdmin ? (
          <select
            value={department ?? ''}
            onChange={(e) => setDepartment((e.target.value || null) as MemberDepartment)}
            disabled={isPending}
            className="h-7 rounded border border-input bg-background px-2 text-xs disabled:opacity-50"
          >
            <option value="">Choose…</option>
            <option value="cm">Capital Markets</option>
            <option value="sm">Sales & Marketing</option>
            <option value="both">Both</option>
          </select>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>

      {/* Open tasks / SPOC — n/a for a brand-new member */}
      <td className="px-4 py-3 text-center text-xs text-muted-foreground">—</td>
      <td className="px-4 py-3 text-center text-xs text-muted-foreground">—</td>

      {/* Status */}
      <td className="px-4 py-3">
        <span className="rounded-full bg-[#B45309]/10 px-2 py-0.5 text-xs font-medium text-[#B45309]">
          Pending
        </span>
      </td>

      {/* Approve */}
      <td className="px-4 py-3">
        {isCurrentUserAdmin ? (
          <div className="flex flex-col items-end gap-1">
            <button
              type="button"
              onClick={approve}
              disabled={isPending || department === null}
              className="h-7 rounded-md bg-[#15803D] px-3 text-xs font-medium text-white transition-colors hover:bg-[#15803D]/90 disabled:cursor-not-allowed disabled:opacity-40"
              title={department === null ? 'Choose a department first' : 'Approve member'}
            >
              {isPending ? 'Approving…' : 'Approve'}
            </button>
            {error && <span className="text-[11px] text-[#B91C1C]">{error}</span>}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Awaiting admin</span>
        )}
      </td>
    </tr>
  );
}
