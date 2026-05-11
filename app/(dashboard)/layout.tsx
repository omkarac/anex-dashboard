import { getAuthenticatedMember } from '@/lib/auth/member';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await getAuthenticatedMember();
  return <>{children}</>;
}
