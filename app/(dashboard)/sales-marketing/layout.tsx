import { AppShell } from '@/components/shared/app-shell';
import { getAuthenticatedMember } from '@/lib/auth/member';
import { getPendingMembersCount } from '@/lib/queries/team';

export default async function SalesMarketingLayout({ children }: { children: React.ReactNode }) {
  const member = await getAuthenticatedMember();
  const pendingMembersCount = member.role === 'admin' ? await getPendingMembersCount() : 0;
  return (
    <AppShell member={member} vertical="sales_marketing" pendingMembersCount={pendingMembersCount}>
      {children}
    </AppShell>
  );
}
