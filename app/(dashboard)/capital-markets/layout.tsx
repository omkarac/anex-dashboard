import { LayoutDashboard, Building2, Users2, ScrollText, UsersRound } from 'lucide-react';
import { AppShell } from '@/components/shared/app-shell';
import { getAuthenticatedMember } from '@/app/(dashboard)/layout';

const CM_NAV = [
  { href: '/capital-markets', label: 'Capital Markets', icon: LayoutDashboard, exact: true },
  { href: '/capital-markets/assets', label: 'Assets', icon: Building2 },
  { href: '/capital-markets/developers', label: 'Developers', icon: Users2 },
  { href: '/capital-markets/logs', label: 'Activity Logs', icon: ScrollText },
  { href: '/capital-markets/team', label: 'Team', icon: UsersRound, adminOnly: true },
];

export default async function CapitalMarketsLayout({ children }: { children: React.ReactNode }) {
  const member = await getAuthenticatedMember();
  return <AppShell member={member} navItems={CM_NAV}>{children}</AppShell>;
}
