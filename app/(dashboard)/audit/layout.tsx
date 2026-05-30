import { AuditShellWrapper } from '@/components/shared/audit-shell-wrapper';
import { getAuthenticatedMember } from '@/lib/auth/member';
import { getPendingMembersCount } from '@/lib/queries/team';

export default async function AuditLayout({ children }: { children: React.ReactNode }) {
  const member = await getAuthenticatedMember();
  const pendingMembersCount = member.role === 'admin' ? await getPendingMembersCount() : 0;
  return (
    <AuditShellWrapper member={member} pendingMembersCount={pendingMembersCount}>
      {children}
    </AuditShellWrapper>
  );
}
