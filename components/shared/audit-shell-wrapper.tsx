'use client';

import { useSearchParams } from 'next/navigation';
import { AppShell, type Vertical } from './app-shell';
import type { TeamMember } from '@/lib/rbac';

type Props = {
  member: TeamMember;
  pendingMembersCount: number;
  children: React.ReactNode;
};

export function AuditShellWrapper({ member, pendingMembersCount, children }: Props) {
  const searchParams = useSearchParams();
  const v = searchParams.get('v');
  const vertical: Vertical = v === 'sm' ? 'sales_marketing' : 'capital_markets';

  return (
    <AppShell member={member} vertical={vertical} pendingMembersCount={pendingMembersCount}>
      {children}
    </AppShell>
  );
}
