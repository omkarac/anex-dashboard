import { Megaphone, ScrollText, UsersRound } from 'lucide-react';
import { AppShell } from '@/components/shared/app-shell';
import { getAuthenticatedMember } from '@/lib/auth/member';

const SM_NAV = [
  { href: '/sales-marketing', label: 'Sales & Marketing', icon: Megaphone, exact: true },
  { href: '/sales-marketing/logs', label: 'Activity Logs', icon: ScrollText },
  { href: '/sales-marketing/team', label: 'Team', icon: UsersRound, adminOnly: true },
];

export default async function SalesMarketingLayout({ children }: { children: React.ReactNode }) {
  const member = await getAuthenticatedMember();
  return <AppShell member={member} navItems={SM_NAV}>{children}</AppShell>;
}
