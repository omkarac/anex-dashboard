import { AppShell } from '@/components/shared/app-shell';
import { getAuthenticatedMember } from '@/lib/auth/member';

export default async function SalesMarketingLayout({ children }: { children: React.ReactNode }) {
  const member = await getAuthenticatedMember();
  return <AppShell member={member} vertical="sales_marketing">{children}</AppShell>;
}
