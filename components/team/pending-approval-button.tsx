'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus } from 'lucide-react';
import { activateMember } from '@/lib/actions/team';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import type { TeamMemberWithWorkload, MemberDepartment } from '@/lib/queries/team';

function PendingCard({
  member,
  isAdmin,
}: {
  member: TeamMemberWithWorkload;
  isAdmin: boolean;
}) {
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
    <div className="rounded-lg border bg-card p-3 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-full bg-[#B45309]/10 text-[#B45309] flex items-center justify-center text-sm font-medium shrink-0">
          {member.full_name[0]?.toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{member.full_name}</p>
          <p className="text-xs text-muted-foreground truncate">{member.email}</p>
        </div>
      </div>
      {isAdmin ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={isPending}
              className="h-8 rounded border border-input bg-background px-2 text-xs disabled:opacity-50"
              aria-label="Role"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
              <option value="sales_manager">Sales Manager</option>
              <option value="sales_head">Sales Head</option>
              <option value="sales_admin">Sales Admin</option>
            </select>
            <select
              value={department ?? ''}
              onChange={(e) => setDepartment((e.target.value || null) as MemberDepartment)}
              disabled={isPending}
              className="h-8 rounded border border-input bg-background px-2 text-xs disabled:opacity-50"
              aria-label="Department"
            >
              <option value="">Choose department…</option>
              <option value="cm">Capital Markets</option>
              <option value="sm">Sales & Marketing</option>
              <option value="both">Both</option>
            </select>
          </div>
          <button
            type="button"
            onClick={approve}
            disabled={isPending || department === null}
            className="h-8 rounded-md bg-[#15803D] px-3 text-xs font-medium text-white transition-colors hover:bg-[#15803D]/90 disabled:cursor-not-allowed disabled:opacity-40"
            title={department === null ? 'Choose a department first' : 'Approve member'}
          >
            {isPending ? 'Approving…' : 'Approve'}
          </button>
          {error && <span className="text-[11px] text-[#B91C1C]">{error}</span>}
        </>
      ) : (
        <span className="text-xs text-muted-foreground">Awaiting admin approval</span>
      )}
    </div>
  );
}

export function PendingApprovalButton({
  pending,
  isAdmin,
}: {
  pending: TeamMemberWithWorkload[];
  isAdmin: boolean;
}) {
  const count = pending.length;
  const hasPending = count > 0;

  return (
    <Sheet>
      <SheetTrigger
        type="button"
        className={
          hasPending
            ? 'relative inline-flex items-center gap-2 rounded-md border border-[#B45309]/30 bg-[#B45309]/10 px-3 h-8 text-xs font-medium text-[#B45309] hover:bg-[#B45309]/20 transition-colors'
            : 'relative inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 h-8 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors'
        }
      >
        <UserPlus className="h-3.5 w-3.5" />
        Pending approval
        <span
          className={
            hasPending
              ? 'relative inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-[#B45309] text-white text-[11px] font-semibold'
              : 'inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-muted text-muted-foreground text-[11px] font-semibold'
          }
        >
          {count}
          {hasPending && (
            <span className="absolute inset-0 rounded-full bg-[#B45309] animate-ping opacity-60" />
          )}
        </span>
      </SheetTrigger>
      <SheetContent side="right" className="w-[420px] sm:max-w-md flex flex-col gap-0 p-0">
        <SheetHeader className="border-b">
          <SheetTitle>Pending approval</SheetTitle>
          <SheetDescription>
            {hasPending
              ? `${count} member${count === 1 ? '' : 's'} waiting for role + department assignment.`
              : 'No members are waiting for approval right now.'}
          </SheetDescription>
        </SheetHeader>
        <div className="scroll-visible flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {hasPending ? (
            pending.map((m) => <PendingCard key={m.id} member={m} isAdmin={isAdmin} />)
          ) : (
            <div className="text-xs text-muted-foreground border border-dashed rounded-lg p-6 text-center">
              You'll see new joiners here once they sign in with an @anexadvisory.com magic link.
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
