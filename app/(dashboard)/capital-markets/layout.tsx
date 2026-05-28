import { AppShell } from '@/components/shared/app-shell';
import { getAuthenticatedMember } from '@/lib/auth/member';
import { getPendingMembersCount } from '@/lib/queries/team';

export default async function CapitalMarketsLayout({ children }: { children: React.ReactNode }) {
  const member = await getAuthenticatedMember();
  const pendingMembersCount = member.role === 'admin' ? await getPendingMembersCount() : 0;
  return (
    <AppShell member={member} vertical="capital_markets" pendingMembersCount={pendingMembersCount}>
      {children}
    </AppShell>
  );
}
